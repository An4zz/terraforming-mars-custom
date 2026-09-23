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
      <CardCopiesEditor :modelValue="cardCopies" @update:modelValue="$emit('update:cardCopies', $event)" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import CardCopiesEditor from './CardCopiesEditor.vue';
import {CardCopies} from '@/common/custom/CustomGameOptions';

/**
 * The fork's additions to the new game form, gathered in one collapsible panel.
 *
 * Each option is a `v-model` the form stores and sends with the new game.
 */
export default defineComponent({
  name: 'CustomGameSettings',
  components: {CardCopiesEditor},
  props: {
    cardCopies: {
      type: Object as () => CardCopies,
      required: true,
    },
  },
  emits: ['update:cardCopies'],
  data() {
    return {
      open: false,
    };
  },
  computed: {
    summary(): string {
      const entries = Object.entries(this.cardCopies).filter(([, count]) => (count ?? 1) > 1);
      if (entries.length === 0) {
        return '';
      }
      return entries.map(([name, count]) => `${count}× ${name}`).join(', ');
    },
  },
});
</script>
