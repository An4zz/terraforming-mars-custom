<template>
  <div class="custom-panel custom-game-settings">
    <div class="custom-panel-title">
      <a href="#" @click.prevent="open = !open" data-test="toggle">
        <span v-i18n>Custom pool</span>
        <span class="custom-muted" v-if="summary !== ''"> — {{ summary }}</span>
        <span class="custom-muted"> [{{ open ? '−' : '+' }}]</span>
      </a>
    </div>
    <div v-show="open">
      <WorkshopCardsFilter :modelValue="customCards" @update:modelValue="$emit('update:customCards', $event)" />
      <CardCopiesEditor :modelValue="cardCopies" @update:modelValue="$emit('update:cardCopies', $event)" />
      <PresetHandsEditor
        :modelValue="presetHands"
        :initialDraft="initialDraft"
        :preludeDraft="preludeDraft"
        :ceosDraft="ceosDraft"
        @update:modelValue="$emit('update:presetHands', $event)" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import CardCopiesEditor from './CardCopiesEditor.vue';
import PresetHandsEditor from './PresetHandsEditor.vue';
import WorkshopCardsFilter from './WorkshopCardsFilter.vue';
import {CardCopies, PresetHands} from '@/common/custom/CustomGameOptions';

/**
 * The fork's additions to the new game form, gathered in one collapsible panel.
 *
 * Each option is a `v-model` the form stores and sends with the new game.
 */
export default defineComponent({
  name: 'CustomGameSettings',
  components: {CardCopiesEditor, PresetHandsEditor, WorkshopCardsFilter},
  props: {
    cardCopies: {
      type: Object as () => CardCopies,
      required: true,
    },
    presetHands: {
      type: Object as () => PresetHands,
      required: true,
    },
    customCards: {
      type: Array as () => Array<string>,
      required: true,
    },
    initialDraft: {
      type: Boolean,
      default: false,
    },
    preludeDraft: {
      type: Boolean,
      default: false,
    },
    ceosDraft: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:cardCopies', 'update:presetHands', 'update:customCards'],
  data() {
    return {
      open: false,
    };
  },
  computed: {
    summary(): string {
      const parts: Array<string> = [];
      const entries = Object.entries(this.cardCopies).filter(([, count]) => (count ?? 1) > 1);
      if (entries.length > 0) {
        parts.push(entries.map(([name, count]) => `${count}× ${name}`).join(', '));
      }
      const presetCount = Object.values(this.presetHands).reduce((sum, list) => sum + (list?.length ?? 0), 0);
      if (presetCount > 0) {
        parts.push(`${presetCount} preset starting cards`);
      }
      if (this.customCards.length > 0) {
        parts.push(`${this.customCards.length} workshop cards`);
      }
      return parts.join(' · ');
    },
  },
});
</script>
