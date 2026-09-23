<template>
  <div class="action-queue" data-test="queue-panel">
    <div class="custom-panel-title" v-i18n>Action queue</div>
    <div class="custom-muted" v-i18n>Queued actions are taken for you at the start of your turns, in order, until one is no longer possible.</div>
    <div v-if="model === undefined" class="custom-muted" data-test="loading" v-i18n>Loading…</div>
    <template v-else>
      <div v-if="model.stoppedReason !== undefined" class="action-queue-stopped" data-test="stopped">
        <span v-i18n>Stopped:</span> {{ model.stoppedReason }}
      </div>
      <div v-else-if="model.paused" class="custom-muted" data-test="paused" v-i18n>Paused.</div>
      <ol class="action-queue-list" v-if="queue.length > 0">
        <li v-for="(item, index) in queue" :key="index" class="custom-row" data-test="queue-item">
          <span class="action-queue-label">{{ describe(item) }}</span>
          <AppButton size="tiny" title="↑" :disabled="index === 0" @click="move(index, -1)" />
          <AppButton size="tiny" title="↓" :disabled="index === queue.length - 1" @click="move(index, 1)" />
          <AppButton size="tiny" type="close" @click="removeAt(index)" />
        </li>
      </ol>
      <div v-else class="custom-muted" data-test="empty" v-i18n>Nothing queued.</div>
      <div class="custom-row">
        <select class="form-select" v-model="picked" data-test="picker">
          <option :value="undefined" v-i18n>Add an action…</option>
          <optgroup :label="$t('Play a card')" v-if="model.options.cardsInHand.length > 0">
            <option v-for="name in model.options.cardsInHand" :key="'play-' + name" :value="{type: 'playCard', card: name}">{{ name }}</option>
          </optgroup>
          <optgroup :label="$t('Use a card action')" v-if="model.options.actionCards.length > 0">
            <option v-for="name in model.options.actionCards" :key="'act-' + name" :value="{type: 'cardAction', card: name}">{{ name }}</option>
          </optgroup>
          <optgroup :label="$t('Standard project')">
            <option v-for="name in model.options.standardProjects" :key="'sp-' + name" :value="{type: 'standardProject', name}">{{ name }}</option>
          </optgroup>
          <optgroup :label="$t('Claim a milestone')" v-if="model.options.milestones.length > 0">
            <option v-for="name in model.options.milestones" :key="'m-' + name" :value="{type: 'claimMilestone', name}">{{ name }}</option>
          </optgroup>
          <optgroup :label="$t('Fund an award')" v-if="model.options.awards.length > 0">
            <option v-for="name in model.options.awards" :key="'a-' + name" :value="{type: 'fundAward', name}">{{ name }}</option>
          </optgroup>
          <optgroup :label="$t('Other')">
            <option :value="{type: 'convertHeat'}" v-i18n>Convert heat into temperature</option>
            <option :value="{type: 'convertPlants'}" v-i18n>Convert plants (stops for you to place)</option>
            <option :value="{type: 'endTurn'}" v-i18n>End turn</option>
            <option :value="{type: 'pass'}" v-i18n>Pass for this generation</option>
          </optgroup>
        </select>
        <AppButton title="Add" size="small" :disabled="picked === undefined || !canAdd" @click="add" />
      </div>
      <div class="custom-row">
        <AppButton title="Save queue" size="small" :disabled="busy || !dirty" @click="save" />
        <AppButton :title="model.paused ? 'Resume' : 'Pause'" size="small" :disabled="busy || model.queue.length === 0" @click="model.paused ? resume() : pause()" />
        <AppButton title="Clear" size="small" :disabled="busy || (model.queue.length === 0 && queue.length === 0)" @click="clear" />
        <span v-if="dirty" class="custom-muted" data-test="dirty" v-i18n>Unsaved changes</span>
      </div>
      <div v-if="model.executed.length > 0" class="custom-muted" data-test="executed">
        <span v-i18n>Taken from the queue:</span> {{ model.executed.map(describe).join(', ') }}
      </div>
    </template>
    <div v-if="error !== undefined" class="action-queue-stopped" data-test="error">{{ error }}</div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {paths} from '@/common/app/paths';
import {ActionQueueModel, ActionQueueRequest, MAX_QUEUED_ACTIONS, QueuedAction, TERMINAL_ACTION_TYPES, describeQueuedAction, validateQueue} from '@/common/custom/QueuedAction';
import {translateText} from '@/client/directives/i18n';

type ActionQueuePanelModel = {
  model: ActionQueueModel | undefined;
  /** The queue as edited locally, saved to the server on request. */
  queue: Array<QueuedAction>;
  picked: QueuedAction | undefined;
  busy: boolean;
  error: string | undefined;
};

/** Lets the player build, save, pause and clear the actions taken automatically on their turns. */
export default defineComponent({
  name: 'ActionQueuePanel',
  components: {AppButton},
  props: {
    playerId: {
      type: String,
      required: true,
    },
    /** Any change to this value reloads the queue from the server. */
    refreshKey: {
      type: Number,
      default: 0,
    },
  },
  data(): ActionQueuePanelModel {
    return {
      model: undefined,
      queue: [],
      picked: undefined,
      busy: false,
      error: undefined,
    };
  },
  computed: {
    dirty(): boolean {
      return this.model !== undefined && JSON.stringify(this.queue) !== JSON.stringify(this.model.queue);
    },
    canAdd(): boolean {
      if (this.queue.length >= MAX_QUEUED_ACTIONS) {
        return false;
      }
      const last = this.queue[this.queue.length - 1];
      return last === undefined || !TERMINAL_ACTION_TYPES.includes(last.type);
    },
  },
  watch: {
    refreshKey() {
      this.refresh();
    },
  },
  mounted() {
    this.refresh();
  },
  methods: {
    describe(item: QueuedAction): string {
      return translateText(describeQueuedAction(item));
    },
    url(): string {
      return paths.API_CUSTOM_QUEUE + '?id=' + this.playerId;
    },
    apply(model: ActionQueueModel) {
      const keepEdits = this.dirty;
      this.model = model;
      if (!keepEdits) {
        this.queue = model.queue.map((item) => ({...item}));
      }
    },
    async refresh() {
      try {
        const response = await fetch(this.url());
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        this.apply(await response.json());
      } catch (e) {
        this.error = translateText('Could not load the action queue: ') + String(e);
      }
    },
    async post(request: ActionQueueRequest) {
      this.busy = true;
      this.error = undefined;
      try {
        const response = await fetch(this.url(), {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(request),
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const model: ActionQueueModel = await response.json();
        this.model = model;
        this.queue = model.queue.map((item) => ({...item}));
      } catch (e) {
        this.error = String(e);
      } finally {
        this.busy = false;
      }
    },
    add() {
      if (this.picked === undefined || !this.canAdd) {
        return;
      }
      this.queue.push({...this.picked});
      this.picked = undefined;
    },
    removeAt(index: number) {
      this.queue.splice(index, 1);
    },
    move(index: number, delta: number) {
      const target = index + delta;
      if (target < 0 || target >= this.queue.length) {
        return;
      }
      const item = this.queue[index];
      this.queue.splice(index, 1);
      this.queue.splice(target, 0, item);
    },
    save() {
      const problem = validateQueue(this.queue);
      if (problem !== undefined) {
        this.error = translateText(problem);
        return;
      }
      return this.post({op: 'set', queue: this.queue});
    },
    pause() {
      return this.post({op: 'pause'});
    },
    resume() {
      return this.post({op: 'resume'});
    },
    clear() {
      this.queue = [];
      return this.post({op: 'clear'});
    },
  },
});
</script>

<style scoped>
.action-queue-list {
  margin: 4px 0 4px 18px;
  padding: 0;
}

.action-queue-label {
  min-width: 240px;
}

.action-queue-stopped {
  color: #fc6;
  margin: 4px 0;
}
</style>
