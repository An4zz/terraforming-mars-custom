import {paths} from '@/common/app/paths';
import {IHandler} from '@/server/routes/IHandler';
import {ApiCustomStatus} from './ApiCustomStatus';
import {ApiPresets} from './ApiPresets';
import {ApiDiscordOptIn} from './ApiDiscordOptIn';
import {ApiActionQueue} from './ApiActionQueue';
import {ApiCustomCards, ApiCustomClientCards} from './ApiCustomCards';
import {ServeApp} from '@/server/routes/ServeApp';

/**
 * The route table for the fork's custom features.
 *
 * `requestProcessor.ts` spreads this into its handler map, so upstream's map only needs one hook.
 */
export const CUSTOM_HANDLERS: ReadonlyArray<[string, IHandler]> = [
  [paths.API_CUSTOM_STATUS, ApiCustomStatus.INSTANCE],
  [paths.API_CUSTOM_PRESETS, ApiPresets.INSTANCE],
  [paths.API_CUSTOM_DISCORD, ApiDiscordOptIn.INSTANCE],
  [paths.API_CUSTOM_QUEUE, ApiActionQueue.INSTANCE],
  [paths.API_CUSTOM_CARDS, ApiCustomCards.INSTANCE],
  [paths.API_CUSTOM_CLIENT_CARDS, ApiCustomClientCards.INSTANCE],
  [paths.WORKSHOP, ServeApp.INSTANCE],
];
