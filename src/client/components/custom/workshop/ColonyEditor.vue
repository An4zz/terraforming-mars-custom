<template>
  <div class="colony-editor">
    <div class="custom-panel-title" v-i18n>Colony benefits</div>
    <div v-for="row in rows" :key="row.key" class="custom-row" :data-test="'benefit-' + row.key">
      <span class="colony-benefit-label">{{ $t(row.label) }}</span>
      <select class="form-select form-inline" :value="benefit(row.key).kind" @change="setKind(row.key, $event)" data-test="benefit-kind">
        <option value="resource" v-i18n>resources</option>
        <option value="production" v-i18n>production</option>
        <option value="cardResource" v-i18n>card resources</option>
        <option value="tr" v-i18n>TR</option>
        <option value="cards" v-i18n>cards</option>
      </select>
      <select v-if="needsResource(row.key)" class="form-select form-inline" :value="benefit(row.key).resource ?? ''" @change="setResource(row.key, $event)" data-test="benefit-resource">
        <option v-for="resource in resources" :key="resource" :value="resource">{{ resource }}</option>
      </select>
      <span class="custom-muted">{{ $t(row.hint) }}</span>
      <input v-for="(q, i) in quantities(row.key)" :key="i" type="number" class="form-input form-inline colony-quantity" :value="q" min="0" max="20" @change="setQuantity(row.key, i, $event)" data-test="benefit-quantity">
    </div>
    <div class="custom-row">
      <span class="colony-benefit-label" v-i18n>Card resource</span>
      <select class="form-select form-inline" :value="value.cardResource ?? ''" @change="setCardResource($event)" data-test="card-resource">
        <option value="">—</option>
        <option v-for="resource in cardResources" :key="resource" :value="resource">{{ resource }}</option>
      </select>
      <span class="custom-muted" v-i18n>(needed by "card resources" benefits)</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CustomColonyBenefit, CustomColonyDefinition} from '@/common/custom/CustomCardDefinition';
import {Resource} from '@/common/Resource';
import {CardResource} from '@/common/CardResource';

type Key = 'colonyBonus' | 'buildBonus' | 'tradeBonus';
type Row = {key: Key, label: string, hint: string};

const ROWS: ReadonlyArray<Row> = [
  {key: 'buildBonus', label: 'Build bonus', hint: 'per colony slot (3)'},
  {key: 'tradeBonus', label: 'Trade bonus', hint: 'per track position (7)'},
  {key: 'colonyBonus', label: 'Colony bonus', hint: 'to each owner when anyone trades'},
];

export function defaultColony(): CustomColonyDefinition {
  return {
    buildBonus: {kind: 'production', resource: Resource.MEGACREDITS, quantity: [1, 1, 1]},
    tradeBonus: {kind: 'resource', resource: Resource.MEGACREDITS, quantity: [1, 2, 3, 4, 5, 6, 7]},
    colonyBonus: {kind: 'resource', resource: Resource.MEGACREDITS, quantity: 1},
  };
}

/** Edits the three benefits of a workshop colony. */
export default defineComponent({
  name: 'ColonyEditor',
  props: {
    modelValue: {
      type: Object as () => CustomColonyDefinition | undefined,
      required: false,
    },
  },
  emits: ['update:modelValue'],
  computed: {
    rows(): ReadonlyArray<Row> {
      return ROWS;
    },
    value(): CustomColonyDefinition {
      return this.modelValue ?? defaultColony();
    },
    resources(): ReadonlyArray<Resource> {
      return Object.values(Resource);
    },
    cardResources(): ReadonlyArray<CardResource> {
      return Object.values(CardResource);
    },
  },
  methods: {
    benefit(key: Key): CustomColonyBenefit<number | Array<number>> {
      return this.value[key];
    },
    needsResource(key: Key): boolean {
      const kind = this.benefit(key).kind;
      return kind === 'resource' || kind === 'production';
    },
    quantities(key: Key): Array<number> {
      const q = this.benefit(key).quantity;
      return Array.isArray(q) ? q : [q];
    },
    emit(patch: Partial<CustomColonyDefinition>) {
      this.$emit('update:modelValue', {...this.value, ...patch});
    },
    setBenefit(key: Key, patch: Partial<CustomColonyBenefit<number | Array<number>>>) {
      this.emit({[key]: {...this.benefit(key), ...patch}} as Partial<CustomColonyDefinition>);
    },
    setKind(key: Key, event: Event) {
      const kind = (event.target as HTMLSelectElement).value as CustomColonyBenefit<unknown>['kind'];
      const resource = kind === 'resource' || kind === 'production' ? (this.benefit(key).resource ?? Resource.MEGACREDITS) : undefined;
      this.setBenefit(key, {kind, resource});
    },
    setResource(key: Key, event: Event) {
      this.setBenefit(key, {resource: (event.target as HTMLSelectElement).value as Resource});
    },
    setQuantity(key: Key, index: number, event: Event) {
      const raw = Number((event.target as HTMLInputElement).value);
      const n = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
      const current = this.benefit(key).quantity;
      if (Array.isArray(current)) {
        const copy = [...current];
        copy[index] = n;
        this.setBenefit(key, {quantity: copy});
      } else {
        this.setBenefit(key, {quantity: n});
      }
    },
    setCardResource(event: Event) {
      const v = (event.target as HTMLSelectElement).value;
      this.emit({cardResource: v === '' ? undefined : v as CardResource});
    },
  },
});
</script>

<style scoped>
.colony-benefit-label {
  min-width: 110px;
  font-weight: bold;
}

.colony-quantity {
  width: 52px;
}
</style>
