import {DiscordClient, DiscordClientConfig} from './DiscordClient';

type Fetch = typeof fetch;

const API = 'https://discord.com/api/v10';

/** Permissions the bot needs: Send Messages. */
export const BOT_PERMISSIONS = 2048;

export type DiscordCheckResult = {
  /** Each line is one finding, prefixed with `OK`, `WARN` or `FAIL`. */
  lines: Array<string>;
  ok: boolean;
  bot?: {username: string, applicationId: string, inviteUrl: string};
  webhook?: {name: string, channelId: string};
};

/** The URL that adds the bot to a Discord server with the permissions it needs. */
export function botInviteUrl(applicationId: string): string {
  return `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=bot&permissions=${BOT_PERMISSIONS}`;
}

async function getJson(fetchImpl: Fetch, url: string, headers: Record<string, string> = {}): Promise<{ok: boolean, status: number, body: any}> {
  const response = await fetchImpl(url, {headers});
  const text = await response.text();
  let body: any = undefined;
  try {
    body = text.length === 0 ? undefined : JSON.parse(text);
  } catch {
    body = text;
  }
  return {ok: response.ok, status: response.status, body};
}

/**
 * Checks the Discord hosting configuration against Discord itself and explains what to fix.
 *
 * With `sendTo`, also sends a test message each way so delivery is proven end to end.
 */
export async function checkDiscordSetup(config: DiscordClientConfig, fetchImpl: Fetch = fetch, sendTo?: string): Promise<DiscordCheckResult> {
  const result: DiscordCheckResult = {lines: [], ok: true};
  const fail = (line: string) => {
    result.lines.push('FAIL ' + line);
    result.ok = false;
  };
  const warn = (line: string) => result.lines.push('WARN ' + line);
  const good = (line: string) => result.lines.push('OK   ' + line);

  if (config.botToken === undefined && config.webhookUrl === undefined) {
    fail('Neither DISCORD_BOT_TOKEN nor DISCORD_WEBHOOK_URL is set. Turn notifications stay off. See docs/custom/hosting.md.');
    return result;
  }

  if (config.botToken !== undefined) {
    const auth = {Authorization: `Bot ${config.botToken}`};
    const me = await getJson(fetchImpl, `${API}/users/@me`, auth);
    if (!me.ok) {
      fail(`DISCORD_BOT_TOKEN was rejected (${me.status}). Copy the token again from the Bot page of your application.`);
    } else {
      const app = await getJson(fetchImpl, `${API}/oauth2/applications/@me`, auth);
      const applicationId: string = app.ok ? app.body.id : me.body.id;
      const inviteUrl = botInviteUrl(applicationId);
      result.bot = {username: me.body.username, applicationId, inviteUrl};
      good(`Bot token works: logged in as ${me.body.username}.`);
      good(`Invite the bot to your server (once): ${inviteUrl}`);
      const guilds = await getJson(fetchImpl, `${API}/users/@me/guilds`, auth);
      if (guilds.ok && Array.isArray(guilds.body)) {
        if (guilds.body.length === 0) {
          warn('The bot is not in any server yet. Direct messages only reach people who share a server with it.');
        } else {
          good(`The bot is in ${guilds.body.length} server(s): ${guilds.body.map((g: {name: string}) => g.name).join(', ')}.`);
        }
      }
    }
  } else {
    warn('DISCORD_BOT_TOKEN is not set: players cannot choose direct messages.');
  }

  if (config.webhookUrl !== undefined) {
    if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(config.webhookUrl)) {
      fail('DISCORD_WEBHOOK_URL does not look like a Discord webhook URL (https://discord.com/api/webhooks/<id>/<token>).');
    } else {
      const hook = await getJson(fetchImpl, config.webhookUrl);
      if (!hook.ok) {
        fail(`DISCORD_WEBHOOK_URL was rejected (${hook.status}). Create the webhook again in the channel settings and copy its URL.`);
      } else {
        result.webhook = {name: hook.body.name, channelId: hook.body.channel_id};
        good(`Webhook works: "${hook.body.name}" posting to channel ${hook.body.channel_id}.`);
      }
    }
  } else {
    warn('DISCORD_WEBHOOK_URL is not set: players cannot choose channel mentions.');
  }

  if (sendTo !== undefined && result.ok) {
    const client = new DiscordClient(config, fetchImpl);
    if (client.dmAvailable) {
      try {
        await client.sendDirectMessage(sendTo, 'Terraforming Mars test: direct messages work.');
        good(`Sent a direct message to ${sendTo}.`);
      } catch (e) {
        fail(`Could not send a direct message to ${sendTo}: ${e instanceof Error ? e.message : e}. The user must share a server with the bot and allow DMs from server members.`);
      }
    }
    if (client.channelAvailable) {
      try {
        await client.sendChannelMessage('Terraforming Mars test: channel mentions work.', sendTo);
        good(`Posted a mention of ${sendTo} through the webhook.`);
      } catch (e) {
        fail(`Could not post through the webhook: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  return result;
}
