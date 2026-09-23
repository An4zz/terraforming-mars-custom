import {paths} from '@/common/app/paths';
import {IHandler} from '@/server/routes/IHandler';
import {ApiCustomStatus} from './ApiCustomStatus';
import {ApiPresets} from './ApiPresets';

/**
 * The route table for the fork's custom features.
 *
 * `requestProcessor.ts` spreads this into its handler map, so upstream's map only needs one hook.
 */
export const CUSTOM_HANDLERS: ReadonlyArray<[string, IHandler]> = [
  [paths.API_CUSTOM_STATUS, ApiCustomStatus.INSTANCE],
  [paths.API_CUSTOM_PRESETS, ApiPresets.INSTANCE],
];
