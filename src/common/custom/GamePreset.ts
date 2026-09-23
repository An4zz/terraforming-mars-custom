import {NewGameConfig} from '../game/NewGameConfig';

/** A saved new-game configuration that any player can load from the new game page. */
export type GamePreset = {
  /** The store key, derived from the name. */
  id: string;
  name: string;
  description?: string;
  /** Who saved it, for display only. */
  author?: string;
  updatedAt: number;
  config: NewGameConfig;
};

/** The body posted to save or delete a preset. */
export type GamePresetRequest = {
  op: 'save',
  name: string,
  description?: string,
  config: NewGameConfig,
} | {
  op: 'delete',
  id: string,
};

/** The response to saving a preset. */
export type GamePresetSaveResponse = {
  preset: GamePreset;
  /** Problems worth telling the user about that did not stop the save, like renamed cards. */
  warnings: Array<string>;
};

export const MAX_PRESET_NAME_LENGTH = 60;
export const MAX_PRESET_DESCRIPTION_LENGTH = 500;
export const MAX_PRESETS = 200;

/** The preset name recorded on a game whose settings were changed after loading `name`. */
export function modifiedPresetName(name: string): string {
  return name + ' (modified)';
}
