<template>
  <div class="card-editor">
    <div class="custom-row">
      <label class="form-label" v-i18n>Kind</label>
      <select class="form-select form-inline" :value="card.kind" @change="setKind($event)" data-test="kind">
        <option v-for="kind in kinds" :key="kind" :value="kind">{{ kindLabel(kind) }}</option>
      </select>
      <label class="form-label" v-i18n>Name</label>
      <input class="form-input form-inline card-editor-name" type="text" :value="card.name" maxlength="40" @input="set({name: ($event.target as HTMLInputElement).value})" data-test="name">
      <template v-if="isProject">
        <label class="form-label" v-i18n>Cost</label>
        <input class="form-input form-inline card-editor-number" type="number" min="0" max="60" :value="card.cost ?? 0" @change="setNumber('cost', $event)" data-test="cost">
      </template>
      <template v-if="card.kind === 'corporation' || card.kind === 'prelude'">
        <label class="form-label" v-i18n>Starting M€</label>
        <input class="form-input form-inline card-editor-number" type="number" min="0" max="100" :value="card.startingMegaCredits ?? 0" @change="setNumber('startingMegaCredits', $event)" data-test="startingMegaCredits">
      </template>
    </div>
    <div class="custom-row">
      <label class="form-label" v-i18n>Text on the card</label>
      <textarea class="form-input card-editor-description" rows="2" maxlength="600" :value="card.description" @input="set({description: ($event.target as HTMLTextAreaElement).value})" data-test="description"></textarea>
    </div>
    <template v-if="card.kind !== 'colony'">
      <div class="custom-row">
        <span class="form-label" v-i18n>Tags</span>
        <label v-for="tag in tags" :key="tag" class="form-checkbox form-inline">
          <input type="checkbox" :checked="(card.tags ?? []).includes(tag)" @change="toggleTag(tag, $event)" :data-test="'tag-' + tag"><i class="form-icon"></i> {{ tag }}
        </label>
      </div>
      <div class="custom-row">
        <label class="form-label" v-i18n>Resource type</label>
        <select class="form-select form-inline" :value="card.resourceType ?? ''" @change="setResourceType($event)" data-test="resourceType">
          <option value="">—</option>
          <option v-for="resource in cardResources" :key="resource" :value="resource">{{ resource }}</option>
        </select>
        <label class="form-label" v-i18n>Victory points</label>
        <select class="form-select form-inline" :value="vpMode" @change="setVpMode($event)" data-test="vp-mode">
          <option value="none" v-i18n>none</option>
          <option value="fixed" v-i18n>fixed</option>
          <option value="resource" v-i18n>per resource here</option>
          <option value="tag" v-i18n>per tag</option>
          <option value="city" v-i18n>per city</option>
          <option value="colony" v-i18n>per colony</option>
        </select>
        <template v-if="vpMode === 'fixed'">
          <input class="form-input form-inline card-editor-number" type="number" min="-10" max="20" :value="typeof card.victoryPoints === 'number' ? card.victoryPoints : 0" @change="setFixedVp($event)" data-test="vp-fixed">
        </template>
        <template v-else-if="vpMode !== 'none' && typeof card.victoryPoints === 'object'">
          <input class="form-input form-inline card-editor-number" type="number" min="-5" max="10" :value="card.victoryPoints.points" @change="setScalingVp('points', $event)" data-test="vp-points">
          <span v-i18n>points per</span>
          <input class="form-input form-inline card-editor-number" type="number" min="1" max="10" :value="card.victoryPoints.each" @change="setScalingVp('each', $event)" data-test="vp-each">
          <select v-if="vpMode === 'tag'" class="form-select form-inline" :value="card.victoryPoints.tag ?? ''" @change="setVpTag($event)" data-test="vp-tag">
            <option v-for="tag in tags" :key="tag" :value="tag">{{ tag }}</option>
          </select>
        </template>
      </div>
      <div class="custom-row" v-if="card.kind !== 'event'">
        <label class="form-label" v-i18n>Card discount</label>
        <input class="form-input form-inline card-editor-number" type="number" min="0" max="10" :value="card.cardDiscount?.amount ?? 0" @change="setDiscountAmount($event)" data-test="discount-amount">
        <select class="form-select form-inline" :value="card.cardDiscount?.tag ?? ''" @change="setDiscountTag($event)" data-test="discount-tag">
          <option value="" v-i18n>all cards</option>
          <option v-for="tag in tags" :key="tag" :value="tag">{{ tag }}</option>
        </select>
      </div>
      <RequirementsEditor v-if="isProject" :modelValue="card.requirements" @update:modelValue="set({requirements: $event})" />
      <EffectEditor :modelValue="card.effect" :title="card.kind === 'corporation' ? 'At game start' : 'When played'" @update:modelValue="set({effect: $event})" />
      <EffectEditor v-if="card.kind === 'active' || card.kind === 'corporation'" :modelValue="card.action" title="Action (once per generation)" :withPrice="true" @update:modelValue="set({action: $event})" />
    </template>
    <ColonyEditor v-else :modelValue="card.colony" @update:modelValue="set({colony: $event})" />
    <ImageUpload :modelValue="card.image" @update:modelValue="set({image: $event})" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import EffectEditor from './EffectEditor.vue';
import RequirementsEditor from './RequirementsEditor.vue';
import ImageUpload from './ImageUpload.vue';
import ColonyEditor, {defaultColony} from './ColonyEditor.vue';
import {CUSTOM_CARD_KINDS, CustomCardDefinition, CustomCardKind, CustomVictoryPoints} from '@/common/custom/CustomCardDefinition';
import {ALL_TAGS, Tag} from '@/common/cards/Tag';
import {CardResource} from '@/common/CardResource';

const KIND_LABELS: Record<CustomCardKind, string> = {
  automated: 'Project card (green)',
  active: 'Active card (blue)',
  event: 'Event (red)',
  corporation: 'Corporation',
  prelude: 'Prelude',
  colony: 'Colony',
};

type VpMode = 'none' | 'fixed' | 'resource' | 'tag' | 'city' | 'colony';

function readInt(event: Event, fallback = 0): number {
  const raw = Number((event.target as HTMLInputElement).value);
  return Number.isFinite(raw) ? Math.trunc(raw) : fallback;
}

/** The form for one workshop card; every change is emitted as a whole new definition. */
export default defineComponent({
  name: 'CardEditor',
  components: {EffectEditor, RequirementsEditor, ImageUpload, ColonyEditor},
  props: {
    modelValue: {
      type: Object as () => CustomCardDefinition,
      required: true,
    },
  },
  emits: ['update:modelValue'],
  computed: {
    card(): CustomCardDefinition {
      return this.modelValue;
    },
    kinds(): ReadonlyArray<CustomCardKind> {
      return CUSTOM_CARD_KINDS;
    },
    isProject(): boolean {
      return this.card.kind === 'automated' || this.card.kind === 'active' || this.card.kind === 'event';
    },
    tags(): ReadonlyArray<Tag> {
      return ALL_TAGS.filter((t) => t !== Tag.EVENT && t !== Tag.CLONE);
    },
    cardResources(): ReadonlyArray<CardResource> {
      return Object.values(CardResource);
    },
    vpMode(): VpMode {
      const vp = this.card.victoryPoints;
      if (vp === undefined) {
        return 'none';
      }
      return typeof vp === 'number' ? 'fixed' : vp.per;
    },
  },
  methods: {
    kindLabel(kind: CustomCardKind): string {
      return KIND_LABELS[kind];
    },
    set(patch: Partial<CustomCardDefinition>) {
      this.$emit('update:modelValue', {...this.card, ...patch});
    },
    setNumber(key: 'cost' | 'startingMegaCredits', event: Event) {
      this.set({[key]: Math.max(0, readInt(event))});
    },
    setKind(event: Event) {
      const kind = (event.target as HTMLSelectElement).value as CustomCardKind;
      const patch: Partial<CustomCardDefinition> = {kind};
      if (kind === 'colony' && this.card.colony === undefined) {
        patch.colony = defaultColony();
      }
      if (kind !== 'active' && kind !== 'corporation') {
        patch.action = undefined;
      }
      this.set(patch);
    },
    toggleTag(tag: Tag, event: Event) {
      const checked = (event.target as HTMLInputElement).checked;
      const tags = (this.card.tags ?? []).filter((t) => t !== tag);
      if (checked) {
        tags.push(tag);
      }
      this.set({tags: tags.length === 0 ? undefined : tags});
    },
    setResourceType(event: Event) {
      const v = (event.target as HTMLSelectElement).value;
      this.set({resourceType: v === '' ? undefined : v as CardResource});
    },
    setVpMode(event: Event) {
      const mode = (event.target as HTMLSelectElement).value as VpMode;
      let vp: CustomVictoryPoints | undefined;
      switch (mode) {
      case 'none': vp = undefined; break;
      case 'fixed': vp = 1; break;
      case 'tag': vp = {per: 'tag', tag: Tag.JOVIAN, points: 1, each: 1}; break;
      default: vp = {per: mode, points: 1, each: 1};
      }
      this.set({victoryPoints: vp});
    },
    setFixedVp(event: Event) {
      this.set({victoryPoints: readInt(event, 1)});
    },
    setScalingVp(key: 'points' | 'each', event: Event) {
      const vp = this.card.victoryPoints;
      if (typeof vp !== 'object') {
        return;
      }
      this.set({victoryPoints: {...vp, [key]: readInt(event, 1)}});
    },
    setVpTag(event: Event) {
      const vp = this.card.victoryPoints;
      if (typeof vp !== 'object') {
        return;
      }
      this.set({victoryPoints: {...vp, tag: (event.target as HTMLSelectElement).value as Tag}});
    },
    setDiscountAmount(event: Event) {
      const amount = Math.max(0, readInt(event));
      this.set({cardDiscount: amount === 0 ? undefined : {tag: this.card.cardDiscount?.tag, amount}});
    },
    setDiscountTag(event: Event) {
      const v = (event.target as HTMLSelectElement).value;
      const amount = this.card.cardDiscount?.amount ?? 0;
      this.set({cardDiscount: amount === 0 ? undefined : {tag: v === '' ? undefined : v as Tag, amount}});
    },
  },
});
</script>

<style scoped>
.card-editor-name {
  width: 220px;
}

.card-editor-number {
  width: 64px;
}

.card-editor-description {
  width: 100%;
  max-width: 520px;
}
</style>
