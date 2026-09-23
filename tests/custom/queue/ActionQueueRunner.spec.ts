import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {Resource} from '@/common/Resource';
import {cast} from '@/common/utils/utils';
import {ActionQueueRunner} from '@/server/custom/queue/ActionQueueRunner';
import {TurnNotifier} from '@/server/custom/discord/TurnNotifier';
import {MemoryCustomStore} from '@/server/custom/store/MemoryCustomStore';
import {Game} from '@/server/Game';
import {IGame} from '@/server/IGame';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {PowerPlant} from '@/server/cards/base/PowerPlant';
import {DomedCrater} from '@/server/cards/base/DomedCrater';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions, setOxygenLevel} from '../../TestingUtils';
import {FakeClock} from '../../common/FakeClock';
import {FakeDiscordClient} from '../discord/FakeDiscordClient';

describe('ActionQueueRunner', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;
  let discord: FakeDiscordClient;
  let notifier: TurnNotifier;

  beforeEach(async () => {
    [game, player, player2] = testGame(2);
    discord = new FakeDiscordClient();
    notifier = new TurnNotifier(discord, new FakeClock(), new MemoryCustomStore());
    TurnNotifier.setInstance(notifier);
    player.megaCredits = 40;
    player.cardsInHand.push(new PowerPlant());
  });

  afterEach(() => {
    TurnNotifier.setInstance(undefined);
  });

  function startTurn(p: TestPlayer) {
    game.activePlayer = p;
    p.actionsTakenThisRound = 0;
    p.takeAction();
    runAllActions(game);
  }

  it('does nothing without a queue', () => {
    startTurn(player);
    expect(cast(player.getWaitingFor(), OrOptions).title).contains('first action');
    expect(player.cardsInHand).has.length(1);
  });

  it('runs queued actions in order across both actions of a turn, then passes control', () => {
    player.actionQueue.queue = [
      {type: 'playCard', card: CardName.POWER_PLANT},
      {type: 'standardProject', name: CardName.ASTEROID_STANDARD_PROJECT},
      {type: 'pass'},
    ];
    startTurn(player);
    // Two actions end the turn; the pass waits for the next one.
    expect(player.playedCards.has(CardName.POWER_PLANT)).is.true;
    expect(player.production.energy).eq(1);
    expect(game.getTemperature()).eq(-28);
    expect(player.megaCredits).eq(40 - 4 - 14);
    expect(player.actionQueue.queue.map((i) => i.type)).deep.eq(['pass']);
    expect(player.actionQueue.executed).has.length(2);
    expect(player.actionQueue.paused).is.false;
    expect(game.activePlayer).eq(player2);
    expect(game.gameLog.filter((e) => e.message.includes('queued action'))).has.length(2);

    // Player 2 passes; the queue passes for player 1 at the start of their next turn.
    const options = cast(player2.getWaitingFor(), OrOptions);
    const passIndex = options.options.findIndex((o) => o.title === 'Pass for this generation');
    player2.process({type: 'or', index: passIndex, response: {type: 'option'}});
    runAllActions(game);
    // Both passed, so the generation ended.
    expect(game.generation).eq(2);
    expect(player.actionQueue.queue).is.empty;
    expect(player.actionQueue.executed).has.length(3);
    expect(game.gameLog.filter((e) => e.message.includes('queued action'))).has.length(3);
  });

  it('stops before the first impossible item, keeps it, and tells the player', async () => {
    await notifier.setOptIn(player.id, {enabled: true, discordUserId: '100000000000000001', delivery: 'dm'});
    player.actionQueue.queue = [
      {type: 'playCard', card: CardName.POWER_PLANT},
      {type: 'playCard', card: CardName.COMET},
      {type: 'pass'},
    ];
    startTurn(player);
    expect(player.playedCards.has(CardName.POWER_PLANT)).is.true;
    expect(player.actionQueue.paused).is.true;
    expect(player.actionQueue.stoppedReason).contains('Comet is not in your hand');
    expect(player.actionQueue.queue.map((i) => i.type)).deep.eq(['playCard', 'pass']);
    expect(game.getPassedPlayers()).not.contains(player.color);
    expect(cast(player.getWaitingFor(), OrOptions).title).contains('next action');
    await notifier.flush();
    expect(discord.sent.some((m) => m.content.includes('queue stopped'))).is.true;
    expect(game.gameLog.some((e) => e.message.includes('queue stopped') && e.playerId === player.id)).is.true;
  });

  it('pauses at a follow-up prompt and resumes after it is answered', () => {
    player.cardsInHand.push(new DomedCrater());
    player.production.add(Resource.ENERGY, 1);
    setOxygenLevel(game, 7);
    player.actionQueue.queue = [
      {type: 'playCard', card: CardName.DOMED_CRATER},
      {type: 'playCard', card: CardName.POWER_PLANT},
    ];
    startTurn(player);
    const selectSpace = cast(player.getWaitingFor(), SelectSpace);
    expect(player.actionQueue.queue.map((i) => i.type)).deep.eq(['playCard']);
    expect(player.playedCards.has(CardName.POWER_PLANT)).is.false;

    player.process({type: 'space', spaceId: selectSpace.spaces[0].id});
    runAllActions(game);
    expect(player.playedCards.has(CardName.POWER_PLANT)).is.true;
    expect(player.actionQueue.queue).is.empty;
  });

  it('pays for an award automatically', () => {
    player.actionQueue.queue = [{type: 'fundAward', name: game.awards[0].name}];
    startTurn(player);
    expect(game.fundedAwards).has.length(1);
    expect(player.megaCredits).eq(40 - 8);
    expect(player.actionQueue.queue).is.empty;
    expect(cast(player.getWaitingFor(), OrOptions).title).contains('next action');
  });

  it('does not run while paused, outside the action phase, or during the research phase', () => {
    player.actionQueue.queue = [{type: 'pass'}];
    player.actionQueue.paused = true;
    startTurn(player);
    expect(game.getPassedPlayers()).not.contains(player.color);

    player.actionQueue.paused = false;
    game.phase = Phase.RESEARCH;
    player.clearWaitingFor();
    player.setWaitingFor(player.getActions());
    ActionQueueRunner.maybeRun(player);
    expect(game.getPassedPlayers()).not.contains(player.color);
  });

  it('pauses after an undo', () => {
    player.actionQueue.queue = [{type: 'pass'}];
    player.actionQueue.undoCount = 0;
    game.undoCount = 1;
    startTurn(player);
    expect(player.actionQueue.paused).is.true;
    expect(player.actionQueue.stoppedReason).contains('undone');
    expect(game.getPassedPlayers()).not.contains(player.color);
  });

  it('keeps the queue through serialization', () => {
    player.actionQueue.queue = [{type: 'playCard', card: CardName.POWER_PLANT}, {type: 'pass'}];
    player.actionQueue.paused = true;
    player.actionQueue.stoppedReason = 'why';
    const reloaded = Game.deserialize(JSON.parse(JSON.stringify(game.serialize())));
    const p = reloaded.getPlayerById(player.id);
    expect(p.actionQueue).deep.eq({queue: [{type: 'playCard', card: CardName.POWER_PLANT}, {type: 'pass'}], paused: true, stoppedReason: 'why', executed: []});
  });

  it('defaults to an empty queue for older saves', () => {
    const serialized = JSON.parse(JSON.stringify(game.serialize()));
    delete serialized.players[0].actionQueue;
    const reloaded = Game.deserialize(serialized);
    expect(reloaded.getPlayerById(player.id).actionQueue).deep.eq({queue: [], paused: false, executed: []});
  });

  it('lists what can be queued', () => {
    const options = ActionQueueRunner.options(player);
    expect(options.cardsInHand).deep.eq([CardName.POWER_PLANT]);
    expect(options.standardProjects).contains(CardName.ASTEROID_STANDARD_PROJECT);
    expect(options.milestones).has.length(5);
    expect(options.awards).has.length(5);
    expect(options.actionCards).is.empty;
  });
});
