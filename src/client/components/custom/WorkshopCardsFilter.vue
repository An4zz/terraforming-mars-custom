<template>
  <div class="workshop-cards-filter">
    <div class="custom-panel-title"><span v-i18n>Workshop cards</span> <a href="workshop" target="_blank" class="custom-muted" v-i18n>(open the workshop)</a></div>
    <div v-if="cards.length === 0" class="custom-muted" data-test="none" v-i18n>No workshop cards saved yet.</div>
    <div v-for="card in cards" :key="card.id" class="custom-row" data-test="workshop-card">
      <label class="form-checkbox form-inline">
        <input type="checkbox" :checked="modelValue.includes(card.id)" @change="toggle(card.id, $event)" :data-test="'include-' + card.id"><i class="form-icon"></i>
        {{ card.name }} <span class="custom-muted">({{ card.kind }})</span>
      </label>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {paths} from '@/common/app/paths';
import {CustomCardDefinition} from '@/common/custom/CustomCardDefinition';

/** Picks the workshop cards and colonies a new game includes. */
export default defineComponent({
  name: 'WorkshopCardsFilter',
  props: {
    modelValue: {
      type: Array as () => Array<string>,
      required: true,
    },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      cards: [] as Array<CustomCardDefinition>,
    };
  },
  mounted() {
    this.refresh();
  },
  methods: {
    async refresh() {
      try {
        const response = await fetch(paths.API_CUSTOM_CARDS);
        if (response.ok) {
          this.cards = await response.json();
        }
      } catch (e) {
        console.warn('Could not load workshop cards', e);
      }
    },
    toggle(id: string, event: Event) {
      const checked = (event.target as HTMLInputElement).checked;
      const ids = this.modelValue.filter((i) => i !== id);
      if (checked) {
        ids.push(id);
      }
      this.$emit('update:modelValue', ids);
    },
  },
});
</script>
