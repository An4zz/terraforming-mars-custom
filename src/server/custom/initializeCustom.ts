import {CustomStore} from './store/CustomStore';
import {TurnNotifier} from './discord/TurnNotifier';

/**
 * Starts the fork's custom services.
 *
 * Runs after the database is initialized and before the server listens.
 */
export async function initializeCustom(): Promise<void> {
  await CustomStore.getInstance().initialize();
  await TurnNotifier.getInstance().initialize();
}
