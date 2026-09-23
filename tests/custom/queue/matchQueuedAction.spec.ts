import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {QueueMatch, matchQueuedAction} from '@/server/custom/queue/matchQueuedAction';
import {IGame} from '@/server/IGame';
import {OrOptions} from '@/server/inputs/OrOptions';
import {Tardigrades} from '@/server/cards/base/Tardigrades';
import {SpaceElevator} from '@/server/cards/base/SpaceElevator';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {OrOptionsResponse} from '@/common/inputs/InputResponse';

describe('matchQueuedAction', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2);
    player.megaCredits = 30;
  });

  function actions(): OrOptions {
    return player.getActions();
  }

  function response(match: QueueMatch): OrOptionsResponse {
    if ('reason' in match) {
      throw new Error('expected a match, got ' + match.reason);
    }
    return match.response;
  }

  function reason(match: QueueMatch): string {
    if ('response' in match) {
      throw new Error('expected a reason');
    }
    return match.reason;
  }

  it('plays a card from hand with an automatic payment', () => {
    player.cardsInHand.push(new Tardigrades());
    const r = response(matchQueuedAction(player, actions(), {type: 'playCard', card: CardName.TARDIGRADES}));
    expect(r.response).deep.include({type: 'projectCard', card: CardName.TARDIGRADES});
    expect((r.response as any).payment.megacredits).eq(4);
  });

  it('spends titanium on a space card', () => {
    player.megaCredits = 20;
    player.titanium = 3;
    player.cardsInHand.push(new SpaceElevator());
    const r = response(matchQueuedAction(player, actions(), {type: 'playCard', card: CardName.SPACE_ELEVATOR}));
    expect((r.response as any).payment.titanium).eq(3);
    expect((r.response as any).payment.megacredits).eq(18);
  });

  it('explains a card that is missing or unaffordable', () => {
    expect(reason(matchQueuedAction(player, actions(), {type: 'playCard', card: CardName.COMET}))).contains('not in your hand');
    player.cardsInHand.push(new SpaceElevator());
    player.megaCredits = 5;
    expect(reason(matchQueuedAction(player, actions(), {type: 'playCard', card: CardName.SPACE_ELEVATOR}))).contains('cannot be played');
  });

  it('uses a blue card action', () => {
    const card = new Tardigrades();
    player.playedCards.push(card);
    const r = response(matchQueuedAction(player, actions(), {type: 'cardAction', card: CardName.TARDIGRADES}));
    expect(r.response).deep.eq({type: 'card', cards: [CardName.TARDIGRADES]});
    player.actionsThisGeneration.add(CardName.TARDIGRADES);
    expect(reason(matchQueuedAction(player, actions(), {type: 'cardAction', card: CardName.TARDIGRADES}))).contains('not available');
  });

  it('plays a standard project', () => {
    const r = response(matchQueuedAction(player, actions(), {type: 'standardProject', name: CardName.POWER_PLANT_STANDARD_PROJECT}));
    expect((r.response as any).card).eq(CardName.POWER_PLANT_STANDARD_PROJECT);
    expect((r.response as any).payment.megacredits).eq(11);
    player.megaCredits = 5;
    expect(reason(matchQueuedAction(player, actions(), {type: 'standardProject', name: CardName.POWER_PLANT_STANDARD_PROJECT}))).contains('not available');
    expect(reason(matchQueuedAction(player, actions(), {type: 'standardProject', name: CardName.BUILD_COLONY_STANDARD_PROJECT}))).contains('not in this game');
  });

  it('claims a milestone and funds an award', () => {
    player.megaCredits = 30;
    const milestone = game.milestones[0];
    const originalCanClaim = milestone.canClaim;
    milestone.canClaim = () => true;
    try {
      const r = response(matchQueuedAction(player, actions(), {type: 'claimMilestone', name: milestone.name}));
      expect(r.response).deep.eq({type: 'or', index: 0, response: {type: 'option'}});
      expect(reason(matchQueuedAction(player, actions(), {type: 'claimMilestone', name: 'Nope'}))).contains('not available');
    } finally {
      milestone.canClaim = originalCanClaim;
    }
    const award = game.awards[1];
    const r = response(matchQueuedAction(player, actions(), {type: 'fundAward', name: award.name}));
    expect(r.response).deep.eq({type: 'or', index: 1, response: {type: 'option'}});
    player.megaCredits = 0;
    expect(reason(matchQueuedAction(player, actions(), {type: 'fundAward', name: award.name}))).contains('no award');
  });

  it('converts heat, and explains plants', () => {
    expect(reason(matchQueuedAction(player, actions(), {type: 'convertHeat'}))).contains('cannot convert heat');
    player.heat = 8;
    expect(response(matchQueuedAction(player, actions(), {type: 'convertHeat'})).response).deep.eq({type: 'option'});
    expect(reason(matchQueuedAction(player, actions(), {type: 'convertPlants'}))).contains('cannot convert plants');
    player.plants = 8;
    expect(reason(matchQueuedAction(player, actions(), {type: 'convertPlants'}))).contains('choose the space');
  });

  it('passes and ends the turn', () => {
    expect(response(matchQueuedAction(player, actions(), {type: 'pass'})).response).deep.eq({type: 'option'});
    expect(reason(matchQueuedAction(player, actions(), {type: 'endTurn'}))).contains('not available');
    player.actionsTakenThisRound = 1;
    expect(response(matchQueuedAction(player, actions(), {type: 'endTurn'})).response).deep.eq({type: 'option'});
  });
});
