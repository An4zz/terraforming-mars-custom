import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Resource} from '@/common/Resource';
import {ActionQueueModel} from '@/common/custom/QueuedAction';
import {statusCode} from '@/common/http/statusCode';
import {cast} from '@/common/utils/utils';
import {ApiActionQueue} from '@/server/custom/routes/ApiActionQueue';
import {Game} from '@/server/Game';
import {IPlayer} from '@/server/IPlayer';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {PowerPlant} from '@/server/cards/base/PowerPlant';
import {DomedCrater} from '@/server/cards/base/DomedCrater';
import {MockRequest, MockResponse} from '../../routes/HttpMocks';
import {RouteTestScaffolding} from '../../routes/RouteTestScaffolding';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {runAllActions, setOxygenLevel} from '../../TestingUtils';

/**
 * A three-player game driven through the queue route: player 2 queues while player 1 plays, the
 * queue runs when the turn comes, pauses at a tile placement, and finishes after the placement.
 * (Three players, so a pass by one does not let the next take unlimited actions.)
 */
describe('action queue game', () => {
  let scaffolding: RouteTestScaffolding;
  let alice: TestPlayer;
  let bob: TestPlayer;
  let cara: TestPlayer;
  let game: Game;

  beforeEach(async () => {
    scaffolding = new RouteTestScaffolding(new MockRequest());
    [game, alice, bob, cara] = testGame(3) as [Game, TestPlayer, TestPlayer, TestPlayer];
    await scaffolding.ctx.gameLoader.add(game);
    bob.megaCredits = 60;
    bob.production.add(Resource.ENERGY, 1);
    bob.cardsInHand.push(new PowerPlant(), new DomedCrater());
    setOxygenLevel(game, 7);
    game.activePlayer = alice;
    alice.takeAction();
    runAllActions(game);
  });

  async function post(player: IPlayer, body: unknown): Promise<ActionQueueModel> {
    const req = new MockRequest();
    const res = new MockResponse();
    scaffolding.req = req;
    scaffolding.url = '/api/custom/queue?id=' + player.id;
    const posting = scaffolding.post(ApiActionQueue.INSTANCE, res);
    await Promise.resolve().then(() => {
      req.emitString(JSON.stringify(body));
      req.emitter.emit('end');
    });
    await posting;
    expect(res.statusCode).eq(statusCode.ok);
    return JSON.parse(res.content);
  }

  function pass(player: IPlayer) {
    const options = cast(player.getWaitingFor(), OrOptions);
    const index = options.options.findIndex((o) => o.title === 'Pass for this generation');
    player.process({type: 'or', index, response: {type: 'option'}});
    runAllActions(game);
  }

  it('runs on the next turn, pauses for a tile, then continues and ends the turn', async () => {
    const queued = await post(bob, {op: 'set', queue: [
      {type: 'playCard', card: CardName.DOMED_CRATER},
      {type: 'playCard', card: CardName.POWER_PLANT},
      {type: 'fundAward', name: game.awards[0].name},
    ]});
    expect(queued.queue).has.length(3);
    expect(bob.playedCards.has(CardName.DOMED_CRATER)).is.false;

    pass(alice);
    expect(game.activePlayer).eq(bob);
    // Domed Crater was played and now asks where the city goes; the queue waits.
    expect(bob.playedCards.has(CardName.DOMED_CRATER)).is.true;
    const selectSpace = cast(bob.getWaitingFor(), SelectSpace);
    expect(bob.actionQueue.queue.map((i) => i.type)).deep.eq(['playCard', 'fundAward']);
    expect(bob.actionQueue.paused).is.false;

    bob.process({type: 'space', spaceId: selectSpace.spaces[0].id});
    runAllActions(game);
    // The second action of the turn was Power Plant; the award waits for the next turn.
    expect(bob.playedCards.has(CardName.POWER_PLANT)).is.true;
    expect(bob.actionQueue.queue.map((i) => i.type)).deep.eq(['fundAward']);
    expect(game.activePlayer).eq(cara);

    pass(cara);
    expect(game.activePlayer).eq(bob);
    expect(game.fundedAwards).has.length(1);
    expect(bob.actionQueue.queue).is.empty;
    expect(bob.actionQueue.executed).has.length(3);
    expect(cast(bob.getWaitingFor(), OrOptions).title).contains('next action');

    const req = new MockRequest();
    const res = new MockResponse();
    scaffolding.req = req;
    scaffolding.url = '/api/custom/queue?id=' + bob.id;
    await scaffolding.get(ApiActionQueue.INSTANCE, res);
    const model: ActionQueueModel = JSON.parse(res.content);
    expect(model.executed.map((i) => i.type)).deep.eq(['playCard', 'playCard', 'fundAward']);
    expect(model.options.cardsInHand).deep.eq([]);
    expect(model.options.awards).has.length(4);
  });

  it('stops at an unplayable card, and saving a fixed queue runs it at once', async () => {
    bob.megaCredits = 5;
    await post(bob, {op: 'set', queue: [{type: 'playCard', card: CardName.DOMED_CRATER}, {type: 'pass'}]});
    pass(alice);
    expect(bob.actionQueue.paused).is.true;
    expect(bob.actionQueue.stoppedReason).contains('Domed Crater cannot be played');
    expect(bob.playedCards.has(CardName.DOMED_CRATER)).is.false;
    expect(cast(bob.getWaitingFor(), OrOptions).title).contains('first action');

    // The player drops the card they cannot afford and saves; the rest runs at once.
    const fixed = await post(bob, {op: 'set', queue: [{type: 'pass'}]});
    expect(fixed.paused).is.false;
    expect(fixed.queue).deep.eq([]);
    expect(fixed.executed).deep.eq([{type: 'pass'}]);
    expect(game.getPassedPlayers()).contains(bob.color);
    expect(game.activePlayer).eq(cara);
  });
});
