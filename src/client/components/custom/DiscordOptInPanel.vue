<template>
  <div class="discord-opt-in" data-test="discord-panel">
    <div class="custom-panel-title" v-i18n>Discord turn notifications</div>
    <div v-if="status === undefined" class="custom-muted" data-test="loading" v-i18n>Loading…</div>
    <template v-else-if="!available">
      <div class="custom-muted" data-test="unavailable" v-i18n>This server is not set up to send Discord notifications.</div>
    </template>
    <template v-else>
      <div class="custom-row">
        <label class="form-label" v-i18n>Discord user id</label>
        <input class="form-input form-inline discord-user-id" type="text" v-model="discordUserId" placeholder="123456789012345678" data-test="user-id">
        <a href="https://support.discord.com/hc/en-us/articles/206346498" target="_blank" rel="noopener noreferrer" class="custom-muted" v-i18n>How to find it</a>
      </div>
      <div class="custom-row">
        <label class="form-radio form-inline" v-if="status.dmAvailable">
          <input type="radio" value="dm" v-model="delivery" data-test="delivery-dm"><i class="form-icon"></i> <span v-i18n>Direct message</span>
        </label>
        <label class="form-radio form-inline" v-if="status.channelAvailable">
          <input type="radio" value="channel" v-model="delivery" data-test="delivery-channel"><i class="form-icon"></i> <span v-i18n>Mention in the group channel</span>
        </label>
      </div>
      <div class="custom-row">
        <AppButton :title="enabled ? 'Update' : 'Turn on'" size="small" :disabled="busy || !validId" @click="save" />
        <AppButton title="Turn off" size="small" :disabled="busy || !enabled" @click="clear" />
        <AppButton title="Send test" size="small" :disabled="busy || !enabled" @click="test" />
        <span class="custom-muted" data-test="state">{{ stateText }}</span>
      </div>
    </template>
    <div v-if="message !== undefined" class="custom-muted" data-test="message">{{ message }}</div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {paths} from '@/common/app/paths';
import {DiscordNotificationStatus, isValidDiscordUserId} from '@/common/custom/DiscordNotification';
import {translateText} from '@/client/directives/i18n';

const LAST_ID_KEY = 'tm_custom_discord_user_id';

type DiscordOptInPanelModel = {
  status: DiscordNotificationStatus | undefined;
  discordUserId: string;
  delivery: 'dm' | 'channel';
  busy: boolean;
  message: string | undefined;
};

function rememberedId(): string | undefined {
  try {
    return localStorage.getItem(LAST_ID_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function rememberId(id: string): void {
  try {
    localStorage.setItem(LAST_ID_KEY, id);
  } catch {
    // Storage is a convenience only.
  }
}

/** Lets the player turn Discord turn notifications on or off for this game. */
export default defineComponent({
  name: 'DiscordOptInPanel',
  components: {AppButton},
  props: {
    playerId: {
      type: String,
      required: true,
    },
  },
  data(): DiscordOptInPanelModel {
    return {
      status: undefined,
      discordUserId: '',
      delivery: 'dm',
      busy: false,
      message: undefined,
    };
  },
  computed: {
    available(): boolean {
      return this.status !== undefined && (this.status.dmAvailable || this.status.channelAvailable);
    },
    enabled(): boolean {
      return this.status?.optIn?.enabled === true;
    },
    validId(): boolean {
      return isValidDiscordUserId(this.discordUserId.trim());
    },
    stateText(): string {
      if (!this.enabled) {
        return translateText('Off');
      }
      return translateText('On') + ' (' + (this.status?.optIn?.delivery === 'dm' ? translateText('direct message') : translateText('channel mention')) + ')';
    },
  },
  mounted() {
    this.refresh();
  },
  methods: {
    url(): string {
      return paths.API_CUSTOM_DISCORD + '?id=' + this.playerId;
    },
    applyStatus(status: DiscordNotificationStatus) {
      this.status = status;
      const optIn = status.optIn;
      if (optIn !== undefined) {
        this.discordUserId = optIn.discordUserId;
        this.delivery = optIn.delivery;
      } else {
        if (this.discordUserId === '') {
          this.discordUserId = status.sessionDiscordUserId ?? rememberedId() ?? '';
        }
        this.delivery = status.dmAvailable ? 'dm' : 'channel';
      }
    },
    async refresh() {
      try {
        const response = await fetch(this.url());
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        this.applyStatus(await response.json());
      } catch (e) {
        this.status = {dmAvailable: false, channelAvailable: false, optIn: undefined, sessionDiscordUserId: undefined};
        this.message = translateText('Could not load notification settings: ') + String(e);
      }
    },
    async post(body: unknown, success: string) {
      this.busy = true;
      this.message = undefined;
      try {
        const response = await fetch(this.url(), {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        this.applyStatus(await response.json());
        this.message = translateText(success);
      } catch (e) {
        this.message = String(e);
      } finally {
        this.busy = false;
      }
    },
    save() {
      const id = this.discordUserId.trim();
      rememberId(id);
      return this.post({op: 'save', discordUserId: id, delivery: this.delivery}, 'Notifications are on.');
    },
    clear() {
      return this.post({op: 'clear'}, 'Notifications are off.');
    },
    test() {
      return this.post({op: 'test'}, 'Test message sent.');
    },
  },
});
</script>

<style scoped>
.discord-user-id {
  width: 220px;
}
</style>
