import {CustomStore} from './store/CustomStore';

/**
 * Starts the fork's custom services.
 *
 * Runs after the database is initialized and before the server listens.
 */
export async function initializeCustom(): Promise<void> {
  await CustomStore.getInstance().initialize();
}
