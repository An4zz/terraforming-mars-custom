import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Game} from '@/server/Game';
import {GameCards} from '@/server/GameCards';
import {DEFAULT_GAME_OPTIONS} from '@/server/game/GameOptions';
import {testGame} from '../../TestGame';

describe('card pool game', () => {
  it('builds a deck with the requested copies and keeps them after a reload', () => {
    const [game] = testGame(2, {
      cardCopies: {[CardName.ASTEROID]: 3, [CardName.BIG_ASTEROID]: 2, [CardName.ALGAE]: 1},
      bannedCards: [CardName.COMET],
    });
    const names = (g: typeof game) => [...g.projectDeck.drawPile, ...g.projectDeck.discardPile]
      .map((card) => card.name)
      .concat(g.players.flatMap((p) => p.dealtProjectCards.map((card) => card.name)));
    const count = (all: Array<CardName>, name: CardName) => all.filter((n) => n === name).length;

    const before = names(game);
    expect(count(before, CardName.ASTEROID)).eq(3);
    expect(count(before, CardName.BIG_ASTEROID)).eq(2);
    expect(count(before, CardName.ALGAE)).eq(1);
    expect(count(before, CardName.COMET)).eq(0);

    const baseline = new GameCards({...DEFAULT_GAME_OPTIONS, bannedCards: [CardName.COMET]}).getProjectCards().length;
    expect(game.projectDeck.drawPile.length + game.projectDeck.discardPile.length + 20).eq(baseline + 3);

    const reloaded = Game.deserialize(JSON.parse(JSON.stringify(game.serialize())));
    const after = names(reloaded);
    expect(count(after, CardName.ASTEROID)).eq(3);
    expect(count(after, CardName.BIG_ASTEROID)).eq(2);
    expect(reloaded.gameOptions.cardCopies).deep.eq({[CardName.ASTEROID]: 3, [CardName.BIG_ASTEROID]: 2, [CardName.ALGAE]: 1});
  });

  it('adds copies to the prelude deck', () => {
    const [game] = testGame(2, {preludeExtension: true, cardCopies: {[CardName.BIOLAB]: 3}});
    const all = [...game.preludeDeck.drawPile, ...game.preludeDeck.discardPile]
      .map((card) => card.name)
      .concat(game.players.flatMap((p) => p.dealtPreludeCards.map((card) => card.name)));
    expect(all.filter((name) => name === CardName.BIOLAB)).has.length(3);
  });

  it('adds a card from a disabled expansion like an included card', () => {
    const [game] = testGame(2, {cardCopies: {[CardName.STRATOSPHERIC_BIRDS]: 2}});
    const all = [...game.projectDeck.drawPile].map((card) => card.name)
      .concat(game.players.flatMap((p) => p.dealtProjectCards.map((card) => card.name)));
    expect(all.filter((name) => name === CardName.STRATOSPHERIC_BIRDS)).has.length(2);
  });
});
