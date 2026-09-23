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
  author?: string,
  config: NewGameConfig,
} | {
  op: 'delete',
  id: string,
};
