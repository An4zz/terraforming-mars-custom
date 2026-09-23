import {CardName} from '../cards/CardName';

/**
 * The starting cards every player is dealt instead of a random draw.
 *
 * A list that is absent or empty keeps the normal random deal for that kind of card. A list shorter
 * than the normal deal is topped up from the deck.
 */
export type PresetHands = {
  projectCards?: Array<CardName>;
  corporations?: Array<CardName>;
  preludes?: Array<CardName>;
  ceos?: Array<CardName>;
};

/**
 * The number of copies of a card in the deck, keyed by card name.
 *
 * Only cards with a value greater than 1 need to appear. Applies to project cards and preludes.
 */
export type CardCopies = Partial<Record<CardName, number>>;

/** The fork's additions to the game options, all optional so old JSON settings still load. */
export type CustomGameOptions = {
  /** Workshop card ids included in this game. */
  customCards?: Array<string>;
  cardCopies?: CardCopies;
  presetHands?: PresetHands;
};

export const MAX_CARD_COPIES = 10;

/** True when `hands` names at least one card. */
export function hasPresetHands(hands: PresetHands | undefined): boolean {
  if (hands === undefined) {
    return false;
  }
  return (hands.projectCards?.length ?? 0) > 0 ||
    (hands.corporations?.length ?? 0) > 0 ||
    (hands.preludes?.length ?? 0) > 0 ||
    (hands.ceos?.length ?? 0) > 0;
}

/** True when any card has more than one copy. */
export function hasCardCopies(copies: CardCopies | undefined): boolean {
  if (copies === undefined) {
    return false;
  }
  return Object.values(copies).some((count) => count !== undefined && count > 1);
}
