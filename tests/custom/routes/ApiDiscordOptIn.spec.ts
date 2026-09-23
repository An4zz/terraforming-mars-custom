import {expect} from 'chai';
import {ApiDiscordOptIn} from '@/server/custom/routes/ApiDiscordOptIn';
import {TurnNotifier} from '@/server/custom/discord/TurnNotifier';
import {MemoryCustomStore} from '@/server/custom/store/MemoryCustomStore';
import {statusCode} from '@/common/http/statusCode';
import {Game} from '@/server/Game';
import {MockRequest, MockResponse} from '../../routes/HttpMocks';
import {RouteTestScaffolding} from '../../routes/RouteTestScaffolding';
import {TestPlayer} from '../../TestPlayer';
import {FakeClock} from '../../common/FakeClock';
import {FakeDiscordClient} from '../discord/FakeDiscordClient';

describe('ApiDiscordOptIn', () => {
  let req: MockRequest;
  let res: MockResponse;
  let scaffolding: RouteTestScaffolding;
  let client: FakeDiscordClient;
  let notifier: TurnNotifier;
  let player: TestPlayer;

  beforeEach(async () => {
    client = new FakeDiscordClient(true, false);
    notifier = new TurnNotifier(client, new FakeClock(), new MemoryCustomStore());
    TurnNotifier.setInstance(notifier);
    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
    player = TestPlayer.BLUE.newPlayer();
    const game = Game.newInstance('game-id', [player], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    scaffolding.url = '/api/custom/discord?id=' + player.id;
  });

  afterEach(() => {
    TurnNotifier.setInstance(undefined);
  });

  /** Fresh request and response objects on the same game loader. */
  function reset() {
    req = new MockRequest();
    res = new MockResponse();
    scaffolding.req = req;
  }

  async function post(body: unknown): Promise<void> {
    const posting = scaffolding.post(ApiDiscordOptIn.INSTANCE, res);
    await Promise.resolve().then(() => {
      req.emitString(JSON.stringify(body));
      req.emitter.emit('end');
    });
    await posting;
  }

  it('reports availability and no opt-in', async () => {
    scaffolding.ctx.user = {id: '777777777777777777', username: 'drew', discriminator: '0'};
    await scaffolding.get(ApiDiscordOptIn.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    const status = JSON.parse(res.content);
    expect(status.dmAvailable).is.true;
    expect(status.channelAvailable).is.false;
    expect(status.optIn).is.undefined;
    expect(status.sessionDiscordUserId).eq('777777777777777777');
  });

  it('404s for an unknown player', async () => {
    scaffolding.url = '/api/custom/discord?id=p-unknown-id';
    await scaffolding.get(ApiDiscordOptIn.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('saves an opt-in', async () => {
    await post({op: 'save', discordUserId: ' 100000000000000001 ', delivery: 'dm'});
    expect(res.statusCode).eq(statusCode.ok);
    expect(JSON.parse(res.content).optIn).deep.eq({enabled: true, discordUserId: '100000000000000001', delivery: 'dm'});
    expect(notifier.getOptIn(player.id)?.discordUserId).eq('100000000000000001');
  });

  it('rejects a bad user id, a bad delivery, and an unavailable delivery', async () => {
    await post({op: 'save', discordUserId: 'drew#1234', delivery: 'dm'});
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('Discord user id');

    reset();
    await post({op: 'save', discordUserId: '100000000000000001', delivery: 'sms'});
    expect(res.statusCode).eq(statusCode.badRequest);

    reset();
    await post({op: 'save', discordUserId: '100000000000000001', delivery: 'channel'});
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('no Discord channel');
    expect(notifier.getOptIn(player.id)).is.undefined;
  });

  it('clears an opt-in', async () => {
    await notifier.setOptIn(player.id, {enabled: true, discordUserId: '100000000000000001', delivery: 'dm'});
    await post({op: 'clear'});
    expect(res.statusCode).eq(statusCode.ok);
    expect(JSON.parse(res.content).optIn).is.undefined;
    expect(notifier.getOptIn(player.id)).is.undefined;
  });

  it('sends a test message, and reports when it cannot', async () => {
    await post({op: 'test'});
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('Turn on notifications first');

    await notifier.setOptIn(player.id, {enabled: true, discordUserId: '100000000000000001', delivery: 'dm'});
    reset();
    await post({op: 'test'});
    expect(res.statusCode).eq(statusCode.ok);
    expect(client.sent).has.length(1);

    client.failNext = true;
    reset();
    await post({op: 'test'});
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('discord down');
  });

  it('rejects bad bodies', async () => {
    const posting = scaffolding.post(ApiDiscordOptIn.INSTANCE, res);
    await Promise.resolve().then(() => {
      req.emitString('{oops');
      req.emitter.emit('end');
    });
    await posting;
    expect(res.statusCode).eq(statusCode.badRequest);
  });
});
