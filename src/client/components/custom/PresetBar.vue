<template>
  <div class="custom-panel preset-bar">
    <div class="custom-panel-title" v-i18n>Presets</div>
    <div class="custom-row">
      <select class="form-select" v-model="selectedId" data-test="preset-select">
        <option :value="undefined" v-i18n>Choose a preset…</option>
        <option v-for="preset in presets" :key="preset.id" :value="preset.id">{{ preset.name }}</option>
      </select>
      <AppButton title="Load" size="small" :disabled="selectedId === undefined || busy" @click="load" />
      <AppButton title="Save as…" size="small" :disabled="busy" @click="saving = !saving" />
      <AppButton title="Delete" size="small" :disabled="selectedId === undefined || busy" @click="remove" />
      <AppButton title="Refresh" size="small" :disabled="busy" @click="refresh" />
      <label class="form-checkbox form-inline">
        <input type="checkbox" v-model="keepPlayers" data-test="keep-players">
        <i class="form-icon"></i> <span v-i18n>Keep current players</span>
      </label>
    </div>
    <div v-if="selectedPreset !== undefined" class="custom-muted" data-test="preset-details">
      <span v-if="selectedPreset.description">{{ selectedPreset.description }} · </span>
      <span v-if="selectedPreset.author"><span v-i18n>saved by</span> {{ selectedPreset.author }} · </span>
      <span>{{ new Date(selectedPreset.updatedAt).toLocaleString() }}</span>
    </div>
    <div v-if="saving" class="custom-row" data-test="save-form">
      <input class="form-input" type="text" v-model="saveName" :placeholder="$t('Preset name')" maxlength="60" data-test="save-name">
      <input class="form-input" type="text" v-model="saveDescription" :placeholder="$t('Description (optional)')" maxlength="500" data-test="save-description">
      <AppButton title="Save" size="small" :disabled="saveName.trim().length === 0 || busy" @click="save" />
    </div>
    <div v-if="presetName !== undefined" class="custom-muted" data-test="preset-status">
      <span v-i18n>Preset:</span> {{ presetName }}
    </div>
    <div v-if="error !== undefined" class="custom-muted preset-error" data-test="preset-error">{{ error }}</div>
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {paths} from '@/common/app/paths';
import {GamePreset, GamePresetRequest, GamePresetSaveResponse, modifiedPresetName} from '@/common/custom/GamePreset';
import {NewGameConfig, NewPlayerModel} from '@/common/game/NewGameConfig';
import {translateText} from '@/client/directives/i18n';

type PresetBarModel = {
  presets: Array<GamePreset>;
  selectedId: string | undefined;
  keepPlayers: boolean;
  saving: boolean;
  saveName: string;
  saveDescription: string;
  busy: boolean;
  error: string | undefined;
  /** The name of the preset the form currently reflects, without any modified marker. */
  baseName: string | undefined;
  /** The form snapshot taken right after the preset was applied. */
  baseSnapshot: string | undefined;
  /** True once the preset was already marked modified when it reached this component. */
  alreadyModified: boolean;
};

const MODIFIED_SUFFIX = ' (modified)';

/**
 * Loads, saves and deletes server-stored game presets on the new game form.
 *
 * The parent supplies `getConfig` (the form serialized as a `NewGameConfig`), the current player
 * list, and a `snapshot` string of its state so this component can tell when the loaded preset
 * was changed. `presetName` is a `v-model` the parent stores and sends with the new game.
 */
export default defineComponent({
  name: 'PresetBar',
  components: {AppButton},
  props: {
    getConfig: {
      type: Function as unknown as () => (() => Promise<NewGameConfig | undefined>),
      required: true,
    },
    players: {
      type: Array as () => Array<NewPlayerModel>,
      required: true,
    },
    playersCount: {
      type: Number,
      required: true,
    },
    snapshot: {
      type: String,
      required: true,
    },
    presetName: {
      type: String,
      required: false,
    },
  },
  emits: ['load', 'update:presetName'],
  data(): PresetBarModel {
    return {
      presets: [],
      selectedId: undefined,
      keepPlayers: true,
      saving: false,
      saveName: '',
      saveDescription: '',
      busy: false,
      error: undefined,
      baseName: undefined,
      baseSnapshot: undefined,
      alreadyModified: false,
    };
  },
  computed: {
    selectedPreset(): GamePreset | undefined {
      return this.presets.find((preset) => preset.id === this.selectedId);
    },
    modified(): boolean {
      return this.alreadyModified || (this.baseSnapshot !== undefined && this.snapshot !== this.baseSnapshot);
    },
  },
  watch: {
    snapshot() {
      this.emitName();
    },
    presetName(value: string | undefined) {
      // One of this component's own names, possibly stale: just re-sync it.
      if (this.baseName !== undefined && (value === this.baseName || value === modifiedPresetName(this.baseName))) {
        this.emitName();
        return;
      }
      // A name set from outside (restored settings) becomes the baseline, as if it were loaded here.
      if (value === undefined) {
        this.baseName = undefined;
        this.baseSnapshot = undefined;
        this.alreadyModified = false;
        return;
      }
      this.adoptName(value);
    },
  },
  mounted() {
    this.refresh();
    if (this.presetName !== undefined) {
      this.adoptName(this.presetName);
    }
  },
  methods: {
    expectedName(): string | undefined {
      if (this.baseName === undefined) {
        return undefined;
      }
      return this.modified ? modifiedPresetName(this.baseName) : this.baseName;
    },
    emitName() {
      const name = this.expectedName();
      if (name !== this.presetName) {
        this.$emit('update:presetName', name);
      }
    },
    async adoptName(value: string) {
      this.alreadyModified = value.endsWith(MODIFIED_SUFFIX);
      this.baseName = this.alreadyModified ? value.slice(0, -MODIFIED_SUFFIX.length) : value;
      await nextTick();
      await nextTick();
      this.baseSnapshot = this.snapshot;
    },
    async refresh() {
      this.busy = true;
      this.error = undefined;
      try {
        const response = await fetch(paths.API_CUSTOM_PRESETS);
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        this.presets = await response.json();
        if (this.selectedPreset === undefined) {
          this.selectedId = undefined;
        }
      } catch (e) {
        this.error = translateText('Could not load presets: ') + String(e);
      } finally {
        this.busy = false;
      }
    },
    async post(request: GamePresetRequest): Promise<Response> {
      const response = await fetch(paths.API_CUSTOM_PRESETS, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response;
    },
    async load() {
      const preset = this.selectedPreset;
      if (preset === undefined) {
        return;
      }
      this.error = undefined;
      const config: NewGameConfig = JSON.parse(JSON.stringify(preset.config));
      if (this.keepPlayers) {
        config.players = JSON.parse(JSON.stringify(this.players.slice(0, this.playersCount)));
      }
      config.presetName = preset.name;
      this.$emit('load', config);
      this.alreadyModified = false;
      this.baseName = preset.name;
      this.baseSnapshot = undefined;
      await nextTick();
      await nextTick();
      this.baseSnapshot = this.snapshot;
      this.emitName();
    },
    async save() {
      this.busy = true;
      this.error = undefined;
      try {
        const config = await this.getConfig();
        if (config === undefined) {
          return;
        }
        const response = await this.post({
          op: 'save',
          name: this.saveName.trim(),
          description: this.saveDescription.trim() || undefined,
          config,
        });
        const result: GamePresetSaveResponse = await response.json();
        this.saving = false;
        this.saveName = '';
        this.saveDescription = '';
        await this.refresh();
        this.selectedId = result.preset.id;
        this.alreadyModified = false;
        this.baseName = result.preset.name;
        this.baseSnapshot = this.snapshot;
        this.emitName();
        if (result.warnings.length > 0) {
          this.error = translateText('Saved with warnings: ') + result.warnings.join('; ');
        }
      } catch (e) {
        this.error = translateText('Could not save preset: ') + String(e);
      } finally {
        this.busy = false;
      }
    },
    async remove() {
      const preset = this.selectedPreset;
      if (preset === undefined) {
        return;
      }
      if (!window.confirm(translateText('Delete preset ') + preset.name + '?')) {
        return;
      }
      this.busy = true;
      this.error = undefined;
      try {
        await this.post({op: 'delete', id: preset.id});
        this.selectedId = undefined;
        await this.refresh();
      } catch (e) {
        this.error = translateText('Could not delete preset: ') + String(e);
      } finally {
        this.busy = false;
      }
    },
  },
});
</script>

<style scoped>
.preset-bar select {
  max-width: 260px;
}

.preset-error {
  color: #f88;
}
</style>
