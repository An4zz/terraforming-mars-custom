import {CustomStore} from './store/CustomStore';
import {TurnNotifier} from './discord/TurnNotifier';

/**
 * Starts the fork's custom services.
 *
 * Runs after the database is initialized and before the server listens.
 */
export async function initializeCustom(): Promise<void> {
  await CustomStore.getInstance().initialize();
  const notifier = TurnNotifier.getInstance();
  await notifier.initialize();
  if (!notifier.client.dmAvailable && !notifier.client.channelAvailable) {
    console.log('Discord turn notifications are off. Set DISCORD_BOT_TOKEN and/or DISCORD_WEBHOOK_URL (see docs/custom/hosting.md), then run `npm run discord:check`.');
  }
}
