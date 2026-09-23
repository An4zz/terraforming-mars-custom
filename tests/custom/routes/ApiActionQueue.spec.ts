import {expect} from 'chai';
import {ApiActionQueue} from '@/server/custom/routes/ApiActionQueue';
import {statusCode} from '@/common/http/statusCode';
import {CardName} from '@/common/cards/CardName';
import {ActionQueueModel} from '@/common/custom/QueuedAction';
import {Game} from '@/server/Game';
import {PowerPlant} from '@/server/cards/base/PowerPlant';
import {MockRequest, MockResponse} from '../../routes/HttpMocks';
import {RouteTestScaffolding} from '../../routes/RouteTestScaffolding';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';

describe('ApiActionQueue', () => {
  let req: MockRequest;
  let res: MockResponse;
  let scaffolding: RouteTestScaffolding;
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: Game;

  beforeEach(async () => {
    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
    player = TestPlayer.BLUE.newPlayer();
    player2 = TestPlayer.RED.newPlayer();
    game = Game.newInstance('game-id', [player, player2], player, 'spectatorid');
    player.megaCredits = 40;
    player.cardsInHand.push(new PowerPlant());
    await scaffolding.ctx.gameLoader.add(game);
    scaffolding.url = '/api/custom/queue?id=' + player.id;
  });

  function reset() {
    req = new MockRequest();
    res = new MockResponse();
    scaffolding.req = req;
  }

  async function post(body: unknown): Promise<ActionQueueModel> {
    const posting = scaffolding.post(ApiActionQueue.INSTANCE, res);
    await Promise.resolve().then(() => {
      req.emitString(JSON.stringify(body));
      req.emitter.emit('end');
    });
    await posting;
    return res.statusCode === statusCode.ok ? JSON.parse(res.content) : undefined as unknown as ActionQueueModel;
  }

  it('returns the empty queue with what can be queued', async () => {
    await scaffolding.get(ApiActionQueue.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    const model: ActionQueueModel = JSON.parse(res.content);
    expect(model.queue).deep.eq([]);
    expect(model.paused).is.false;
    expect(model.options.cardsInHand).deep.eq([CardName.POWER_PLANT]);
    expect(model.options.standardProjects).contains(CardName.ASTEROID_STANDARD_PROJECT);
    expect(model.options.milestones).has.length(5);
  });

  it('404s for an unknown player', async () => {
    scaffolding.url = '/api/custom/queue?id=p-unknown-id';
    await scaffolding.get(ApiActionQueue.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('sets a queue while it is not the player\'s turn', async () => {
    game.activePlayer = player2;
    player.clearWaitingFor();
    const model = await post({op: 'set', queue: [{type: 'playCard', card: CardName.POWER_PLANT}, {type: 'pass'}]});
    expect(model.queue).has.length(2);
    expect(model.paused).is.false;
    expect(model.undoCount).eq(0);
    expect(player.playedCards.has(CardName.POWER_PLANT)).is.false;
  });

  it('runs the queue at once when it is the player\'s turn', async () => {
    game.activePlayer = player;
    player.clearWaitingFor();
    player.takeAction();
    runAllActions(game);
    const model = await post({op: 'set', queue: [{type: 'playCard', card: CardName.POWER_PLANT}]});
    expect(model.queue).deep.eq([]);
    expect(model.executed).deep.eq([{type: 'playCard', card: CardName.POWER_PLANT}]);
    expect(player.playedCards.has(CardName.POWER_PLANT)).is.true;
  });

  it('rejects too many items, a pass that is not last, and malformed items', async () => {
    await post({op: 'set', queue: new Array(21).fill({type: 'convertHeat'})});
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('At most 20');
    reset();
    await post({op: 'set', queue: [{type: 'pass'}, {type: 'convertHeat'}]});
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('must be the last item');
    reset();
    await post({op: 'set', queue: [{type: 'playCard'}]});
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('needs a card');
    reset();
    await post({op: 'set', queue: [{type: 'dance'}]});
    expect(res.statusCode).eq(statusCode.badRequest);
    reset();
    await post({op: 'set', queue: 'nope'});
    expect(res.statusCode).eq(statusCode.badRequest);
    reset();
    await post({op: 'jump'});
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(player.actionQueue.queue).is.empty;
  });

  it('pauses, resumes and clears', async () => {
    game.activePlayer = player2;
    player.clearWaitingFor();
    await post({op: 'set', queue: [{type: 'pass'}]});
    reset();
    let model = await post({op: 'pause'});
    expect(model.paused).is.true;
    reset();
    player.actionQueue.stoppedReason = 'stale';
    model = await post({op: 'resume'});
    expect(model.paused).is.false;
    expect(model.stoppedReason).is.undefined;
    reset();
    model = await post({op: 'clear'});
    expect(model.queue).deep.eq([]);
    expect(model.executed).deep.eq([]);
  });
});
