/* global RequestInit */
import {expect} from 'chai';
import {botInviteUrl, checkDiscordSetup} from '@/server/custom/discord/discordSetupCheck';

type Route = (init?: RequestInit) => {status: number, body?: unknown};

describe('checkDiscordSetup', () => {
  let routes: Record<string, Route>;
  let calls: Array<string>;

  const fetchImpl = ((url: string, init?: RequestInit) => {
    calls.push(url);
    const route = routes[url];
    const r = route === undefined ? {status: 404, body: {message: 'Unknown'}} : route(init);
    return Promise.resolve({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      statusText: String(r.status),
      text: () => Promise.resolve(r.body === undefined ? '' : JSON.stringify(r.body)),
    } as Response);
  }) as unknown as typeof fetch;

  const WEBHOOK = 'https://discord.com/api/webhooks/123/abc-DEF_ghi';

  beforeEach(() => {
    calls = [];
    routes = {
      'https://discord.com/api/v10/users/@me': () => ({status: 200, body: {id: '900', username: 'MarsBot'}}),
      'https://discord.com/api/v10/oauth2/applications/@me': () => ({status: 200, body: {id: '901'}}),
      'https://discord.com/api/v10/users/@me/guilds': () => ({status: 200, body: [{name: 'Friends'}]}),
      [WEBHOOK]: (init) => init?.method === 'POST' ? {status: 204} : {status: 200, body: {name: 'TM', channel_id: '555'}},
      'https://discord.com/api/v10/users/@me/channels': () => ({status: 200, body: {id: 'dm-1'}}),
      'https://discord.com/api/v10/channels/dm-1/messages': () => ({status: 200, body: {id: 'm'}}),
    };
  });

  it('fails plainly when nothing is configured', async () => {
    const result = await checkDiscordSetup({}, fetchImpl);
    expect(result.ok).is.false;
    expect(result.lines).has.length(1);
    expect(result.lines[0]).contains('FAIL');
    expect(calls).is.empty;
  });

  it('validates a working bot and webhook, and prints the invite link', async () => {
    const result = await checkDiscordSetup({botToken: 't', webhookUrl: WEBHOOK}, fetchImpl);
    expect(result.ok).is.true;
    expect(result.bot).deep.eq({username: 'MarsBot', applicationId: '901', inviteUrl: botInviteUrl('901')});
    expect(result.webhook).deep.eq({name: 'TM', channelId: '555'});
    expect(result.lines.filter((l) => l.startsWith('OK'))).has.length(4);
    expect(result.lines.some((l) => l.includes('Friends'))).is.true;
    expect(botInviteUrl('901')).eq('https://discord.com/oauth2/authorize?client_id=901&scope=bot&permissions=2048');
  });

  it('warns about a bot in no server and a missing half of the setup', async () => {
    routes['https://discord.com/api/v10/users/@me/guilds'] = () => ({status: 200, body: []});
    const result = await checkDiscordSetup({botToken: 't'}, fetchImpl);
    expect(result.ok).is.true;
    expect(result.lines.some((l) => l.startsWith('WARN') && l.includes('not in any server'))).is.true;
    expect(result.lines.some((l) => l.startsWith('WARN') && l.includes('DISCORD_WEBHOOK_URL'))).is.true;
  });

  it('fails on a rejected token and a bad webhook', async () => {
    routes['https://discord.com/api/v10/users/@me'] = () => ({status: 401, body: {message: 'Unauthorized'}});
    const result = await checkDiscordSetup({botToken: 'bad', webhookUrl: 'https://example.com/hook'}, fetchImpl);
    expect(result.ok).is.false;
    expect(result.lines.filter((l) => l.startsWith('FAIL'))).has.length(2);
    expect(result.lines[0]).contains('401');
    expect(result.lines[1]).contains('does not look like');

    routes[WEBHOOK] = () => ({status: 404});
    const gone = await checkDiscordSetup({webhookUrl: WEBHOOK}, fetchImpl);
    expect(gone.ok).is.false;
    expect(gone.lines.some((l) => l.includes('rejected (404)'))).is.true;
  });

  it('sends test messages both ways when asked', async () => {
    const result = await checkDiscordSetup({botToken: 't', webhookUrl: WEBHOOK}, fetchImpl, '100000000000000001');
    expect(result.ok).is.true;
    expect(result.lines.some((l) => l.includes('Sent a direct message'))).is.true;
    expect(result.lines.some((l) => l.includes('Posted a mention'))).is.true;
    expect(calls.filter((u) => u === 'https://discord.com/api/v10/channels/dm-1/messages')).has.length(1);
  });

  it('explains a failed direct message', async () => {
    routes['https://discord.com/api/v10/users/@me/channels'] = () => ({status: 403, body: {message: 'Cannot send messages to this user'}});
    const result = await checkDiscordSetup({botToken: 't'}, fetchImpl, '100000000000000001');
    expect(result.ok).is.false;
    expect(result.lines.some((l) => l.startsWith('FAIL') && l.includes('share a server'))).is.true;
  });
});
