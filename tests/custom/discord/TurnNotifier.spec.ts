import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {TurnNotifier} from '@/server/custom/discord/TurnNotifier';
import {MemoryCustomStore} from '@/server/custom/store/MemoryCustomStore';
import {SelectOption} from '@/server/inputs/SelectOption';
import {OrOptions} from '@/server/inputs/OrOptions';
import {Game} from '@/server/Game';
import {IGame} from '@/server/IGame';
import {FakeClock} from '../../common/FakeClock';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {FakeDiscordClient} from './FakeDiscordClient';

describe('TurnNotifier', () => {
  let client: FakeDiscordClient;
  let clock: FakeClock;
  let store: MemoryCustomStore;
  let notifier: TurnNotifier;
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(async () => {
    client = new FakeDiscordClient();
    clock = new FakeClock();
    store = new MemoryCustomStore();
    notifier = new TurnNotifier(client, clock, store);
    TurnNotifier.setInstance(notifier);
    [game, player, player2] = testGame(2);
    await notifier.setOptIn(player.id, {enabled: true, discordUserId: '100000000000000001', delivery: 'dm'});
  });

  afterEach(() => {
    TurnNotifier.setInstance(undefined);
  });

  function prompt(title: string, optional = false): OrOptions {
    const input = new OrOptions(new SelectOption('x'));
    input.title = title;
    input.optional = optional;
    return input;
  }

  it('tells an opted-in player about a new prompt, with a link', async () => {
    player.clearWaitingFor();
    player.setWaitingFor(prompt('Take your first action'));
    await notifier.flush();
    expect(client.sent).has.length(1);
    expect(client.sent[0].kind).eq('dm');
    expect(client.sent[0].userId).eq('100000000000000001');
    expect(client.sent[0].content).contains('Take your first action');
    expect(client.sent[0].content).contains('player?id=' + player.id);
    expect(client.sent[0].content).contains('gen 1');
  });

  it('ignores players who did not opt in, disabled opt-ins, optional prompts and finished games', async () => {
    player2.clearWaitingFor();
    player2.setWaitingFor(prompt('Take your first action'));
    await notifier.setOptIn(player2.id, {enabled: false, discordUserId: '100000000000000002', delivery: 'dm'});
    player2.clearWaitingFor();
    player2.setWaitingFor(prompt('Take your next action'));
    player.clearWaitingFor();
    player.setWaitingFor(prompt('Optional thing', true));
    player.clearWaitingFor();
    game.phase = Phase.END;
    player.setWaitingFor(prompt('Final'));
    await notifier.flush();
    expect(client.sent).is.empty;
  });

  it('stays quiet when the same prompt is issued again, as on a reload', async () => {
    player.clearWaitingFor();
    player.setWaitingFor(prompt('Take your first action'));
    player.clearWaitingFor();
    player.setWaitingFor(prompt('Take your first action'));
    await notifier.flush();
    expect(client.sent).has.length(1);
  });

  it('stays quiet for a follow-up prompt right after the player acted', async () => {
    player.clearWaitingFor();
    player.setWaitingFor(prompt('Take your first action'));
    await notifier.flush();
    clock.millis += 5_000;
    player.process({type: 'or', index: 0, response: {type: 'option'}});
    player.clearWaitingFor();
    player.setWaitingFor(prompt('Select space for city'));
    await notifier.flush();
    expect(client.sent).has.length(1);

    clock.millis += 60_000;
    player.clearWaitingFor();
    player.setWaitingFor(prompt('Take your next action'));
    await notifier.flush();
    expect(client.sent).has.length(2);
  });

  it('sends at most one message per player per 30 seconds', async () => {
    player.clearWaitingFor();
    player.setWaitingFor(prompt('A'));
    clock.millis += 10_000;
    player.clearWaitingFor();
    player.setWaitingFor(prompt('B'));
    clock.millis += 30_000;
    player.clearWaitingFor();
    player.setWaitingFor(prompt('C'));
    await notifier.flush();
    expect(client.sent.map((m) => m.content.includes(': A ') ? 'A' : m.content.includes(': C ') ? 'C' : 'B')).deep.eq(['A', 'C']);
  });

  it('uses the channel when asked', async () => {
    await notifier.setOptIn(player.id, {enabled: true, discordUserId: '100000000000000001', delivery: 'channel'});
    player.clearWaitingFor();
    player.setWaitingFor(prompt('Take your first action'));
    await notifier.flush();
    expect(client.sent[0].kind).eq('channel');
    expect(client.sent[0].userId).eq('100000000000000001');
  });

  it('survives a failed send', async () => {
    client.failNext = true;
    player.clearWaitingFor();
    player.setWaitingFor(prompt('Take your first action'));
    await notifier.flush();
    expect(client.sent).is.empty;
    expect(player.getWaitingFor()).is.not.undefined;
  });

  it('persists opt-ins in the store and loads them back', async () => {
    const reloaded = new TurnNotifier(client, clock, store);
    await reloaded.initialize();
    expect(reloaded.getOptIn(player.id)).deep.eq({enabled: true, discordUserId: '100000000000000001', delivery: 'dm'});
    await reloaded.clearOptIn(player.id);
    expect(await store.get('discord', player.id)).is.undefined;
    expect(reloaded.getOptIn(player.id)).is.undefined;
  });

  it('sends direct notifications and test messages', async () => {
    notifier.notify(player, 'Your action queue stopped: Comet is not in your hand');
    await notifier.flush();
    expect(client.sent[0].content).contains('queue stopped');
    expect(client.sent[0].content).contains('player?id=');
    await notifier.sendTest(player, {enabled: true, discordUserId: '5', delivery: 'dm'});
    expect(client.sent[1].content).contains('notifications are on');
  });

  it('does not re-notify a reloaded game that still waits on the same prompt', async () => {
    const [g, p] = testGame(2, {}, 'reload');
    await notifier.setOptIn(p.id, {enabled: true, discordUserId: '100000000000000009', delivery: 'dm'});
    p.clearWaitingFor();
    g.activePlayer = p;
    p.takeAction();
    await notifier.flush();
    expect(client.sent).has.length(1);
    expect(client.sent[0].content).contains(CardName.BEGINNER_CORPORATION.length > 0 ? 'Take your first action' : '');

    const reloaded = Game.deserialize(JSON.parse(JSON.stringify(g.serialize())));
    await notifier.flush();
    expect(reloaded.getPlayerById(p.id).getWaitingFor()).is.not.undefined;
    expect(client.sent).has.length(1);
  });
});
