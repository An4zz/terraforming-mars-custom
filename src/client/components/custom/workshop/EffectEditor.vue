<template>
  <div class="effect-editor">
    <div class="custom-panel-title">{{ $t(title) }}</div>
    <div class="custom-row">
      <span class="effect-label" v-i18n>Production</span>
      <label v-for="unit in units" :key="'prod-' + unit" class="effect-unit">
        {{ unit }} <input type="number" class="form-input form-inline effect-number" :value="value.production?.[unit] ?? 0" min="-10" max="30" @change="setUnits('production', unit, $event)" :data-test="'production-' + unit">
      </label>
    </div>
    <div class="custom-row">
      <span class="effect-label" v-i18n>Gain</span>
      <label v-for="unit in units" :key="'stock-' + unit" class="effect-unit">
        {{ unit }} <input type="number" class="form-input form-inline effect-number" :value="value.stock?.[unit] ?? 0" min="-10" max="30" @change="setUnits('stock', unit, $event)" :data-test="'stock-' + unit">
      </label>
    </div>
    <div class="custom-row">
      <label class="effect-unit"><span v-i18n>TR</span> <input type="number" class="form-input form-inline effect-number" :value="value.tr ?? 0" min="-5" max="10" @change="setNumber('tr', $event)" data-test="tr"></label>
      <label class="effect-unit"><span v-i18n>Temperature steps</span> <input type="number" class="form-input form-inline effect-number" :value="value.temperature ?? 0" min="-2" max="3" @change="setNumber('temperature', $event)" data-test="temperature"></label>
      <label class="effect-unit"><span v-i18n>Oxygen steps</span> <input type="number" class="form-input form-inline effect-number" :value="value.oxygen ?? 0" min="-2" max="2" @change="setNumber('oxygen', $event)" data-test="oxygen"></label>
      <label class="effect-unit"><span v-i18n>Venus steps</span> <input type="number" class="form-input form-inline effect-number" :value="value.venus ?? 0" min="-1" max="3" @change="setNumber('venus', $event)" data-test="venus"></label>
    </div>
    <div class="custom-row">
      <label class="effect-unit"><span v-i18n>Draw cards</span> <input type="number" class="form-input form-inline effect-number" :value="value.drawCards ?? 0" min="0" max="10" @change="setNumber('drawCards', $event)" data-test="drawCards"></label>
      <label class="effect-unit"><span v-i18n>Resources on this card</span> <input type="number" class="form-input form-inline effect-number" :value="value.addResources ?? 0" min="0" max="20" @change="setNumber('addResources', $event)" data-test="addResources"></label>
      <label class="effect-unit"><span v-i18n>Remove any plants</span> <input type="number" class="form-input form-inline effect-number" :value="value.removeAnyPlants ?? 0" min="0" max="20" @change="setNumber('removeAnyPlants', $event)" data-test="removeAnyPlants"></label>
      <label class="effect-unit"><span v-i18n>Place a tile</span>
        <select class="form-select form-inline" :value="value.tile ?? ''" @change="setTile($event)" data-test="tile">
          <option value="">—</option>
          <option value="city" v-i18n>City</option>
          <option value="greenery" v-i18n>Greenery</option>
          <option value="ocean" v-i18n>Ocean</option>
        </select>
      </label>
    </div>
    <div class="custom-row" v-if="withPrice">
      <span class="effect-label" v-i18n>Price</span>
      <label class="effect-unit"><span v-i18n>Resources from this card</span> <input type="number" class="form-input form-inline effect-number" :value="value.spend?.resourcesHere ?? 0" min="0" max="20" @change="setSpend('resourcesHere', $event)" data-test="spend-resourcesHere"></label>
      <label v-for="unit in units" :key="'spend-' + unit" class="effect-unit">
        {{ unit }} <input type="number" class="form-input form-inline effect-number" :value="value.spend?.[unit] ?? 0" min="0" max="30" @change="setSpend(unit, $event)" :data-test="'spend-' + unit">
      </label>
      <span class="custom-muted" v-i18n>(one kind of price is used: card resources first, then the first non-zero resource)</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CustomEffect} from '@/common/custom/CustomCardDefinition';
import {Units} from '@/common/Units';

type NumberKey = 'tr' | 'temperature' | 'oxygen' | 'venus' | 'drawCards' | 'addResources' | 'removeAnyPlants';

function readNumber(event: Event): number {
  const raw = Number((event.target as HTMLInputElement).value);
  return Number.isFinite(raw) ? Math.trunc(raw) : 0;
}

/** Edits one `CustomEffect`: the building blocks a card applies when played or as its action. */
export default defineComponent({
  name: 'EffectEditor',
  props: {
    modelValue: {
      type: Object as () => CustomEffect | undefined,
      required: false,
    },
    title: {
      type: String,
      required: true,
    },
    /** True for an action, which may have a price. */
    withPrice: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  computed: {
    units(): ReadonlyArray<keyof Units> {
      return Units.keys;
    },
    value(): CustomEffect {
      return this.modelValue ?? {};
    },
  },
  methods: {
    emit(effect: CustomEffect) {
      // Drop empty blocks so an untouched effect stays undefined.
      const cleaned: CustomEffect = {};
      for (const [key, v] of Object.entries(effect)) {
        if (v === undefined || v === 0) {
          continue;
        }
        if (typeof v === 'object' && Object.values(v).every((n) => n === 0 || n === undefined)) {
          continue;
        }
        (cleaned as Record<string, unknown>)[key] = v;
      }
      this.$emit('update:modelValue', Object.keys(cleaned).length === 0 ? undefined : cleaned);
    },
    setUnits(block: 'production' | 'stock', unit: keyof Units, event: Event) {
      this.emit({...this.value, [block]: {...this.value[block], [unit]: readNumber(event)}});
    },
    setSpend(key: keyof Units | 'resourcesHere', event: Event) {
      this.emit({...this.value, spend: {...this.value.spend, [key]: Math.max(0, readNumber(event))}});
    },
    setNumber(key: NumberKey, event: Event) {
      this.emit({...this.value, [key]: readNumber(event)});
    },
    setTile(event: Event) {
      const tile = (event.target as HTMLSelectElement).value;
      this.emit({...this.value, tile: tile === '' ? undefined : tile as CustomEffect['tile']});
    },
  },
});
</script>

<style scoped>
.effect-label {
  min-width: 90px;
  font-weight: bold;
}

.effect-unit {
  margin-right: 8px;
  white-space: nowrap;
}

.effect-number {
  width: 58px;
}
</style>
