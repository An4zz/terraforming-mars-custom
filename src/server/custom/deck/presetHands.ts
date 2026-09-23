import {CardName} from '@/common/cards/CardName';
import {resolveCardName} from '@/common/cards/CardRenames';
import {hasPresetHands, PresetHands} from '@/common/custom/CustomGameOptions';
import {Named} from '@/common/Types';
import {IGame} from '@/server/IGame';
import {IPlayer} from '@/server/IPlayer';
import {Deck} from '@/server/cards/Deck';
import {ICard} from '@/server/cards/ICard';
import {ICorporationCard} from '@/server/cards/corporation/ICorporationCard';
import {ICeoCard} from '@/server/cards/ceos/ICeoCard';
import {IPreludeCard} from '@/server/cards/prelude/IPreludeCard';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {newCeo, newCorporationCard, newPrelude, newProjectCard} from '@/server/createCard';
import {GameOptions} from '@/server/game/GameOptions';

export type PresetHandDecks = {
  projectDeck: Deck<IProjectCard>;
  corporationDeck: Deck<ICorporationCard>;
  preludeDeck: Deck<IPreludeCard>;
  ceoDeck: Deck<ICeoCard>;
};

type Category = keyof PresetHands;

/** The categories whose deck copies have already been pulled, per game. */
const applied: WeakMap<IGame, Set<Category>> = new WeakMap();

/**
 * Turns off every draft that would replace a preset deal.
 *
 * Drafting rebuilds the dealt cards from what players pass around, which would discard the preset.
 */
export function disableDraftsForPresetHands(gameOptions: GameOptions): void {
  const hands = gameOptions.presetHands;
  if (hands === undefined) {
    return;
  }
  if ((hands.projectCards?.length ?? 0) > 0) {
    gameOptions.initialDraftVariant = false;
  }
  if ((hands.preludes?.length ?? 0) > 0) {
    gameOptions.preludeDraftVariant = false;
  }
  if ((hands.ceos?.length ?? 0) > 0) {
    gameOptions.ceosDraftVariant = false;
  }
}

function instantiate<T extends ICard>(game: IGame, names: ReadonlyArray<CardName>, factory: (name: CardName) => T | undefined): Array<T> {
  const cards: Array<T> = [];
  for (const name of names) {
    const card = factory(name);
    if (card === undefined) {
      game.log('Preset hand card ${0} was not found and is skipped', (b) => b.rawString(name));
      continue;
    }
    cards.push(card);
  }
  return cards;
}

/** Pulls one copy of each named card out of `deck`, the first time this category is applied to the game. */
function pullFromDeck<T extends Named<CardName>>(game: IGame, category: Category, deck: Deck<T>, names: ReadonlyArray<CardName>) {
  let done = applied.get(game);
  if (done === undefined) {
    done = new Set();
    applied.set(game, done);
  }
  if (done.has(category)) {
    return;
  }
  done.add(category);
  for (const rawName of names) {
    const name = resolveCardName(rawName);
    const pile = deck.drawPile.findIndex((card) => card.name === name) !== -1 ? deck.drawPile : deck.discardPile;
    const index = pile.findIndex((card) => card.name === name);
    if (index !== -1) {
      pile.splice(index, 1);
    }
  }
}

/**
 * Replaces one dealt category with the preset cards, keeping enough random cards to reach `dealSize`.
 *
 * Random cards that are no longer needed go to the bottom of the draw pile.
 */
function applyCategory<T extends ICard>(
  game: IGame,
  category: Category,
  dealt: Array<T>,
  deck: Deck<T>,
  names: ReadonlyArray<CardName> | undefined,
  dealSize: number,
  factory: (name: CardName) => T | undefined): void {
  if (names === undefined || names.length === 0) {
    return;
  }
  pullFromDeck(game, category, deck, names);
  const preset = instantiate(game, names, factory);
  const keep = Math.max(0, dealSize - preset.length);
  if (dealt.length < keep) {
    dealt.push(...deck.drawN(game, keep - dealt.length));
  }
  const surplus = dealt.splice(keep);
  deck.drawPile.unshift(...surplus);
  dealt.unshift(...preset);
}

/**
 * Applies the game's preset hands to `player`, right after the normal deal.
 *
 * Every list is optional; an absent list keeps the random deal. Preludes and CEOs are only
 * applied when their expansion is in the game, since they could not be chosen otherwise.
 */
export function applyPresetHands(game: IGame, player: IPlayer, decks: PresetHandDecks): void {
  const gameOptions = game.gameOptions;
  const hands = gameOptions.presetHands;
  if (!hasPresetHands(hands) || hands === undefined) {
    return;
  }
  disableDraftsForPresetHands(gameOptions);
  if (applied.get(game) === undefined) {
    game.log('Preset hands are in effect: every player starts with the same chosen cards');
  }
  applyCategory(game, 'projectCards', player.dealtProjectCards, decks.projectDeck, hands.projectCards, 10, newProjectCard);
  applyCategory(game, 'corporations', player.dealtCorporationCards, decks.corporationDeck, hands.corporations, gameOptions.startingCorporations, newCorporationCard);
  if (gameOptions.preludeExtension) {
    applyCategory(game, 'preludes', player.dealtPreludeCards, decks.preludeDeck, hands.preludes, gameOptions.startingPreludes, newPrelude);
  }
  if (gameOptions.ceoExtension) {
    applyCategory(game, 'ceos', player.dealtCeoCards, decks.ceoDeck, hands.ceos, gameOptions.startingCeos, newCeo);
  }
}
