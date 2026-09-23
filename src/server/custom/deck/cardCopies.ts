import {CardName} from '@/common/cards/CardName';
import {CARD_RENAMES} from '@/common/cards/CardRenames';
import {CardCopies, MAX_CARD_COPIES} from '@/common/custom/CustomGameOptions';
import {ICard} from '@/server/cards/ICard';

export type CardCopiesOptions<T extends ICard> = {
  /** Cards that must not be added, whatever their copy count. */
  banned: ReadonlyArray<CardName>;
  /** Builds a fresh instance of the named card, or `undefined` when the name is not this kind of card. */
  factory: (name: CardName) => T | undefined;
};

/** The copy count actually applied for `count`: whole, at least 1, at most `MAX_CARD_COPIES`. */
export function effectiveCopies(count: number | undefined): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    return 1;
  }
  return Math.max(1, Math.min(MAX_CARD_COPIES, Math.trunc(count)));
}

/**
 * Adds extra instances to `cards` so each named card appears `copies[name]` times in total.
 *
 * A card absent from `cards` (for instance one outside the enabled expansions) is added
 * with the full count, like `includedCards`. Banned and unknown names are ignored.
 */
export function addCardCopies<T extends ICard>(cards: Array<T>, copies: CardCopies | undefined, options: CardCopiesOptions<T>): void {
  if (copies === undefined) {
    return;
  }
  for (const [rawName, rawCount] of Object.entries(copies)) {
    const name = CARD_RENAMES.get(rawName) ?? rawName as CardName;
    const wanted = effectiveCopies(rawCount);
    if (wanted <= 1 || options.banned.includes(name)) {
      continue;
    }
    const present = cards.filter((card) => card.name === name).length;
    for (let i = present; i < wanted; i++) {
      const card = options.factory(name);
      if (card === undefined) {
        break;
      }
      cards.push(card);
    }
  }
}
