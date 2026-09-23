<template>
  <div class="custom-panel custom-player-panel">
    <div class="custom-panel-title">
      <a href="#" @click.prevent="open = !open" data-test="toggle">
        <span v-i18n>Custom features</span>
        <span class="custom-muted"> [{{ open ? '−' : '+' }}]</span>
      </a>
    </div>
    <div v-show="open">
      <DiscordOptInPanel v-if="open" :playerId="playerId" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import DiscordOptInPanel from './DiscordOptInPanel.vue';

/**
 * The fork's additions to the player page, gathered in one collapsible panel.
 *
 * Its contents load only once opened, so the page never fetches anything extra for players who
 * do not use them.
 */
export default defineComponent({
  name: 'CustomPlayerPanel',
  components: {DiscordOptInPanel},
  props: {
    playerId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      open: false,
    };
  },
});
</script>
