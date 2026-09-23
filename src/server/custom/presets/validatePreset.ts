import {CardName} from '@/common/cards/CardName';
import {CARD_RENAMES} from '@/common/cards/CardRenames';
import {GamePresetRequest, MAX_PRESET_DESCRIPTION_LENGTH, MAX_PRESET_NAME_LENGTH} from '@/common/custom/GamePreset';
import {NewGameConfig} from '@/common/game/NewGameConfig';
import {PLAYER_COLORS} from '@/common/Color';

export type PresetValidation = {
  errors: Array<string>;
  warnings: Array<string>;
};

const VALID_CARD_NAMES: ReadonlySet<string> = new Set(Object.values(CardName));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkCardNames(field: string, names: unknown, warnings: Array<string>) {
  if (names === undefined) {
    return;
  }
  if (!Array.isArray(names)) {
    warnings.push(`${field} is not a list and will be ignored`);
    return;
  }
  for (const name of names) {
    if (typeof name !== 'string') {
      warnings.push(`${field} contains a value that is not a card name`);
      continue;
    }
    if (!VALID_CARD_NAMES.has(name)) {
      const canonical = CARD_RENAMES.get(name as CardName);
      warnings.push(canonical !== undefined ?
        `Old card name '${name}' in ${field}; use '${canonical}'` :
        `Unknown card name '${name}' in ${field}`);
    }
  }
}

/** Checks a preset request and reports what would stop the save (errors) or merely surprise the user (warnings). */
export function validatePresetRequest(body: unknown): PresetValidation {
  const errors: Array<string> = [];
  const warnings: Array<string> = [];
  if (!isRecord(body)) {
    return {errors: ['Body must be an object'], warnings};
  }
  const request = body as Partial<GamePresetRequest>;
  if (request.op === 'delete') {
    if (typeof request.id !== 'string' || request.id.length === 0) {
      errors.push('Missing preset id');
    }
    return {errors, warnings};
  }
  if (request.op !== 'save') {
    return {errors: ['Unknown operation'], warnings};
  }
  const name = typeof request.name === 'string' ? request.name.trim() : '';
  if (name.length === 0 || name.length > MAX_PRESET_NAME_LENGTH) {
    errors.push(`Preset name must be 1 to ${MAX_PRESET_NAME_LENGTH} characters`);
  }
  if (request.description !== undefined) {
    if (typeof request.description !== 'string' || request.description.length > MAX_PRESET_DESCRIPTION_LENGTH) {
      errors.push(`Description must be at most ${MAX_PRESET_DESCRIPTION_LENGTH} characters`);
    }
  }
  const config = request.config as Partial<NewGameConfig> | undefined;
  if (!isRecord(config)) {
    errors.push('Missing game configuration');
    return {errors, warnings};
  }
  if (!Array.isArray(config.players) || config.players.length === 0) {
    errors.push('Configuration must include at least one player');
  } else {
    const colors = new Set<string>();
    for (const player of config.players) {
      if (!isRecord(player) || typeof player.color !== 'string' || !(PLAYER_COLORS as ReadonlyArray<string>).includes(player.color)) {
        errors.push('Every player needs a valid color');
        break;
      }
      colors.add(player.color);
    }
    if (colors.size !== config.players.length) {
      errors.push('Player colors must be distinct');
    }
  }
  if (!isRecord(config.expansions)) {
    errors.push('Configuration must include expansions');
  }
  checkCardNames('bannedCards', config.bannedCards, warnings);
  checkCardNames('includedCards', config.includedCards, warnings);
  checkCardNames('customCorporationsList', config.customCorporationsList, warnings);
  checkCardNames('customPreludes', config.customPreludes, warnings);
  checkCardNames('customCeos', config.customCeos, warnings);
  return {errors, warnings};
}
