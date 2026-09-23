import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Payment} from '@/common/inputs/Payment';
import {cast} from '@/common/utils/utils';
import {Tardigrades} from '@/server/cards/base/Tardigrades';
import {Comet} from '@/server/cards/base/Comet';
import {SellPatentsStandardProject} from '@/server/cards/base/standardProjects/SellPatentsStandardProject';
import {IGame} from '@/server/IGame';
import {SelectCard} from '@/server/inputs/SelectCard';
import {SelectProjectCardToPlay} from '@/server/inputs/SelectProjectCardToPlay';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';

describe('duplicate cards in play', () => {
  let game: IGame;
  let player: TestPlayer;
  let first: Tardigrades;
  let second: Tardigrades;

  beforeEach(() => {
    [game, player] = testGame(2);
    first = new Tardigrades();
    second = new Tardigrades();
    player.cardsInHand.push(first, second);
    player.megaCredits = 100;
  });

  it('both copies are offered as playable', () => {
    const playable = player.getPlayableCards();
    expect(playable.filter((card) => card.name === CardName.TARDIGRADES)).has.length(2);
  });

  it('playing one copy removes exactly one from hand', () => {
    const select = new SelectProjectCardToPlay(player);
    select.process({type: 'projectCard', card: CardName.TARDIGRADES, payment: Payment.of({megacredits: 4})});
    runAllActions(game);
    expect(player.cardsInHand.filter((card) => card.name === CardName.TARDIGRADES)).has.length(1);
    expect(player.playedCards.asArray().filter((card) => card.name === CardName.TARDIGRADES)).has.length(1);
  });

  it('each copy in the tableau tracks its own resources and scores separately', () => {
    player.playCard(first);
    player.playCard(second);
    runAllActions(game);
    for (let i = 0; i < 8; i++) {
      first.action(player);
    }
    for (let i = 0; i < 4; i++) {
      second.action(player);
    }
    runAllActions(game);
    expect(first.resourceCount).eq(8);
    expect(second.resourceCount).eq(4);
    expect(first.getVictoryPoints(player)).eq(2);
    expect(second.getVictoryPoints(player)).eq(1);
    expect(player.getVictoryPoints().victoryPoints).eq(3);
    expect(player.tableau.get(CardName.TARDIGRADES)).eq(first);
    expect(player.tableau.tags.microbe).eq(2);
  });

  it('discarding one copy from the tableau keeps the other findable', () => {
    player.playCard(first);
    player.playCard(second);
    runAllActions(game);
    player.discardPlayedCard(first);
    expect(player.tableau.get(CardName.TARDIGRADES)).eq(second);
    expect(player.tableau.tags.microbe).eq(1);
    player.discardPlayedCard(second);
    expect(player.tableau.has(CardName.TARDIGRADES)).is.false;
    expect(player.tableau.tags.microbe).eq(0);
  });

  it('a duplicate event counts twice', () => {
    const [, p] = testGame(2);
    p.playedCards.push(new Comet(), new Comet());
    expect(p.playedCards.eventCount).eq(2);
    expect(p.playedCards.eventTags.space).eq(2);
  });

  it('selling one copy keeps the other', () => {
    player.megaCredits = 0;
    const select = cast(new SellPatentsStandardProject().action(player), SelectCard<any>);
    select.process({type: 'card', cards: [CardName.TARDIGRADES]});
    expect(player.megaCredits).eq(1);
    expect(player.cardsInHand.filter((card) => card.name === CardName.TARDIGRADES)).has.length(1);
  });
});
