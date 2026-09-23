import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {cast, toName} from '@/common/utils/utils';
import {Game} from '@/server/Game';
import {SelectInitialCards} from '@/server/inputs/SelectInitialCards';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';

/**
 * A three-player Prelude + CEO game where everyone starts from the same chosen cards, reloaded
 * from a save before anyone chooses, then played through the starting selection.
 */
describe('preset hands game', () => {
  it('deals, survives a reload, and lets each player keep the preset cards', () => {
    const presetHands = {
      projectCards: [CardName.ALGAE, CardName.COMET],
      corporations: [CardName.HELION],
      preludes: [CardName.BIOLAB, CardName.ECOLOGY_EXPERTS],
      ceos: [CardName.FLOYD],
    };
    const [original] = testGame(3, {preludeExtension: true, ceoExtension: true, startingCorporations: 2, presetHands});
    const game = Game.deserialize(JSON.parse(JSON.stringify(original.serialize())));
    expect(game.gameOptions.presetHands).deep.eq(presetHands);

    for (const player of game.players) {
      expect(player.dealtProjectCards).has.length(10);
      expect(player.dealtProjectCards.slice(0, 2).map(toName)).deep.eq(presetHands.projectCards);
      expect(player.dealtCorporationCards.map(toName)).contains(CardName.HELION);
      expect(player.dealtPreludeCards.slice(0, 2).map(toName)).deep.eq(presetHands.preludes);
      expect(player.dealtCeoCards[0].name).eq(CardName.FLOYD);

      const select = cast(player.getWaitingFor(), SelectInitialCards);
      select.process({
        type: 'initialCards',
        responses: [
          {type: 'card', cards: [CardName.HELION]},
          {type: 'card', cards: [CardName.BIOLAB, CardName.ECOLOGY_EXPERTS]},
          {type: 'card', cards: [CardName.FLOYD]},
          {type: 'card', cards: [CardName.ALGAE, CardName.COMET]},
        ],
      }, player);
      runAllActions(game);
    }

    for (const player of game.players) {
      expect(player.playedCards.corporations()[0].name).eq(CardName.HELION);
      expect(player.cardsInHand.map(toName)).deep.eq([CardName.ALGAE, CardName.COMET]);
      expect(player.preludeCardsInHand.map(toName)).deep.eq([CardName.BIOLAB, CardName.ECOLOGY_EXPERTS]);
      expect(Array.from(player.ceoCardsInHand).map(toName)).deep.eq([CardName.FLOYD]);
    }
  });
});
