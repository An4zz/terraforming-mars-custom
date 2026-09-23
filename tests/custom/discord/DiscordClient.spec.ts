/* global RequestInit */
import {expect} from 'chai';
import {DiscordClient} from '@/server/custom/discord/DiscordClient';

type Call = {url: string, init: RequestInit};

describe('DiscordClient', () => {
  let calls: Array<Call>;
  let responder: (url: string) => {ok: boolean, status?: number, body?: string};

  const fetchImpl = ((url: string, init: RequestInit) => {
    calls.push({url, init});
    const r = responder(url);
    return Promise.resolve({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      statusText: r.ok ? 'OK' : 'Error',
      text: () => Promise.resolve(r.body ?? ''),
    } as Response);
  }) as unknown as typeof fetch;

  beforeEach(() => {
    calls = [];
    responder = (url) => url.endsWith('/users/@me/channels') ? {ok: true, body: '{"id":"chan-1"}'} : {ok: true};
  });

  it('reports availability from its configuration', () => {
    expect(new DiscordClient({}).dmAvailable).is.false;
    expect(new DiscordClient({}).channelAvailable).is.false;
    expect(new DiscordClient({botToken: 't'}).dmAvailable).is.true;
    expect(new DiscordClient({webhookUrl: 'https://discord.com/api/webhooks/1/x'}).channelAvailable).is.true;
  });

  it('sends a direct message through a DM channel, caching the channel', async () => {
    const client = new DiscordClient({botToken: 'secret'}, fetchImpl);
    await client.sendDirectMessage('123456789012345678', 'hello');
    await client.sendDirectMessage('123456789012345678', 'again');
    expect(calls).has.length(3);
    expect(calls[0].url).eq('https://discord.com/api/v10/users/@me/channels');
    expect(JSON.parse(calls[0].init.body as string)).deep.eq({recipient_id: '123456789012345678'});
    expect((calls[0].init.headers as Record<string, string>)['Authorization']).eq('Bot secret');
    expect(calls[1].url).eq('https://discord.com/api/v10/channels/chan-1/messages');
    expect(JSON.parse(calls[1].init.body as string)).deep.eq({content: 'hello', allowed_mentions: {parse: []}});
    expect(calls[2].url).eq('https://discord.com/api/v10/channels/chan-1/messages');
  });

  it('posts to the webhook with a mention', async () => {
    const client = new DiscordClient({webhookUrl: 'https://discord.com/api/webhooks/1/abc'}, fetchImpl);
    await client.sendChannelMessage('your turn', '42');
    expect(calls[0].url).eq('https://discord.com/api/webhooks/1/abc');
    expect(JSON.parse(calls[0].init.body as string)).deep.eq({content: '<@42> your turn', allowed_mentions: {users: ['42']}});
    await client.sendChannelMessage('plain');
    expect(JSON.parse(calls[1].init.body as string)).deep.eq({content: 'plain', allowed_mentions: {users: []}});
  });

  it('rejects when the feature is not configured', async () => {
    const client = new DiscordClient({}, fetchImpl);
    let error: unknown;
    await client.sendDirectMessage('1', 'x').catch((e) => error = e);
    expect(String(error)).contains('bot token');
    await client.sendChannelMessage('x').catch((e) => error = e);
    expect(String(error)).contains('webhook');
    expect(calls).is.empty;
  });

  it('rejects on an HTTP error without leaking the webhook', async () => {
    responder = () => ({ok: false, status: 404});
    const client = new DiscordClient({webhookUrl: 'https://discord.com/api/webhooks/1/secret-token'}, fetchImpl);
    let error: unknown;
    await client.sendChannelMessage('x').catch((e) => error = e);
    expect(String(error)).contains('404');
    expect(String(error)).not.contains('secret-token');
  });
});
