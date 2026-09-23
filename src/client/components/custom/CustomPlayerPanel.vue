<template>
  <div class="custom-panel custom-player-panel">
    <div class="custom-panel-title">
      <a href="#" @click.prevent="open = !open" data-test="toggle">
        <span v-i18n>Custom features</span>
        <span class="custom-muted"> [{{ open ? '−' : '+' }}]</span>
      </a>
    </div>
    <div v-show="open">
      <ActionQueuePanel v-if="open" :playerId="playerId" :refreshKey="refreshKey" />
      <DiscordOptInPanel v-if="open" :playerId="playerId" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import DiscordOptInPanel from './DiscordOptInPanel.vue';
import ActionQueuePanel from './ActionQueuePanel.vue';

/**
 * The fork's additions to the player page, gathered in one collapsible panel.
 *
 * Its contents load only once opened, so the page never fetches anything extra for players who
 * do not use them.
 */
export default defineComponent({
  name: 'CustomPlayerPanel',
  components: {ActionQueuePanel, DiscordOptInPanel},
  props: {
    playerId: {
      type: String,
      required: true,
    },
    /** Changes whenever the game state changed, so the queue reloads. */
    refreshKey: {
      type: Number,
      default: 0,
    },
  },
  data() {
    return {
      open: false,
    };
  },
});
</script>
