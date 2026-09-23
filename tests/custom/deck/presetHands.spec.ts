import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {toName} from '@/common/utils/utils';
import {IGame} from '@/server/IGame';
import {Game} from '@/server/Game';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';

describe('preset hands', () => {
  function allProjectNames(game: IGame): Array<CardName> {
    return [...game.projectDeck.drawPile, ...game.projectDeck.discardPile].map(toName);
  }

  it('deals the preset project cards first and tops up to ten', () => {
    const [game, player, player2] = testGame(2, {presetHands: {projectCards: [CardName.ALGAE, CardName.COMET, CardName.BIRDS]}});
    for (const p of [player, player2]) {
      expect(p.dealtProjectCards).has.length(10);
      expect(p.dealtProjectCards.slice(0, 3).map(toName)).deep.eq([CardName.ALGAE, CardName.COMET, CardName.BIRDS]);
    }
    expect(player.dealtProjectCards[0]).not.eq(player2.dealtProjectCards[0]);
    const deck = allProjectNames(game);
    expect(deck).not.contains(CardName.ALGAE);
    expect(deck).not.contains(CardName.COMET);
    expect(deck).not.contains(CardName.BIRDS);
    expect(game.gameOptions.initialDraftVariant).is.false;
  });

  it('keeps the deck size right: one card pulled, each player returns one random card', () => {
    const [game] = testGame(2, {presetHands: {projectCards: [CardName.ALGAE]}});
    const [reference] = testGame(2, {}, 'ref');
    expect(allProjectNames(game).length).eq(allProjectNames(reference).length + 1);
  });

  it('gives every player all preset cards even beyond the normal deal', () => {
    const twelve = [
      CardName.ALGAE, CardName.COMET, CardName.BIRDS, CardName.FISH, CardName.ANTS, CardName.PETS,
      CardName.ASTEROID, CardName.BIG_ASTEROID, CardName.TARDIGRADES, CardName.LICHEN, CardName.MOSS, CardName.HERBIVORES,
    ];
    const [, player] = testGame(2, {presetHands: {projectCards: twelve}});
    expect(player.dealtProjectCards.map(toName)).deep.eq(twelve);
  });

  it('turns off the initial draft when project cards are preset', () => {
    const [game, player] = testGame(3, {initialDraftVariant: true, presetHands: {projectCards: [CardName.ALGAE]}});
    expect(game.gameOptions.initialDraftVariant).is.false;
    expect(player.dealtProjectCards).has.length(10);
    expect(player.dealtProjectCards[0].name).eq(CardName.ALGAE);
  });

  it('lets several players share a preset corporation', () => {
    const [, player, player2] = testGame(2, {startingCorporations: 2, presetHands: {corporations: [CardName.HELION]}});
    expect(player.dealtCorporationCards).has.length(2);
    expect(player2.dealtCorporationCards).has.length(2);
    expect(player.dealtCorporationCards[0].name).eq(CardName.HELION);
    expect(player2.dealtCorporationCards[0].name).eq(CardName.HELION);
    expect(player.dealtCorporationCards[1].name).not.eq(CardName.HELION);
  });

  it('applies preludes and CEOs only with their expansions', () => {
    const [game, player] = testGame(2, {
      preludeExtension: true,
      ceoExtension: true,
      preludeDraftVariant: true,
      ceosDraftVariant: true,
      presetHands: {preludes: [CardName.BIOLAB, CardName.ECOLOGY_EXPERTS], ceos: [CardName.FLOYD]},
    });
    expect(player.dealtPreludeCards).has.length(4);
    expect(player.dealtPreludeCards.slice(0, 2).map(toName)).deep.eq([CardName.BIOLAB, CardName.ECOLOGY_EXPERTS]);
    expect(player.dealtCeoCards).has.length(3);
    expect(player.dealtCeoCards[0].name).eq(CardName.FLOYD);
    expect(game.gameOptions.preludeDraftVariant).is.false;
    expect(game.gameOptions.ceosDraftVariant).is.false;

    const [, noPrelude] = testGame(2, {presetHands: {preludes: [CardName.BIOLAB], ceos: [CardName.FLOYD]}}, 'np');
    expect(noPrelude.dealtPreludeCards).is.empty;
    expect(noPrelude.dealtCeoCards).is.empty;
  });

  it('skips unknown names and leaves a log entry', () => {
    const [game, player] = testGame(2, {presetHands: {projectCards: ['Not A Card' as CardName, CardName.ALGAE]}});
    expect(player.dealtProjectCards).has.length(10);
    expect(player.dealtProjectCards[0].name).eq(CardName.ALGAE);
    expect(game.gameLog.some((entry) => entry.message.includes('was not found'))).is.true;
    expect(game.gameLog.some((entry) => entry.message.includes('Preset hands are in effect'))).is.true;
  });

  it('leaves a beginner corporation player alone', () => {
    const player = TestPlayer.BLUE.newPlayer({beginner: true});
    const player2 = TestPlayer.RED.newPlayer();
    const game = Game.newInstance('gameid', [player, player2], player, 'spectatorid', {presetHands: {projectCards: [CardName.ALGAE]}});
    expect(player.dealtProjectCards).is.empty;
    expect(player.dealtCorporationCards).is.empty;
    expect(player.pickedCorporationCard?.name).eq(CardName.BEGINNER_CORPORATION);
    expect(player2.dealtProjectCards[0].name).eq(CardName.ALGAE);
    expect(game.gameOptions.initialDraftVariant).is.false;
  });

  it('does nothing without preset hands or with empty lists', () => {
    const [game, player] = testGame(2, {initialDraftVariant: false, presetHands: {projectCards: [], corporations: []}});
    expect(player.dealtProjectCards).has.length(10);
    expect(game.gameLog.some((entry) => entry.message.includes('Preset hands'))).is.false;
  });
});
