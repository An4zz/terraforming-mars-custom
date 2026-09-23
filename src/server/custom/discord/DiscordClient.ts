/** Sends messages to Discord users or a channel. */
export interface IDiscordClient {
  /** True when direct messages can be sent (a bot token is configured). */
  readonly dmAvailable: boolean;
  /** True when channel messages can be posted (a webhook is configured). */
  readonly channelAvailable: boolean;
  sendDirectMessage(userId: string, content: string): Promise<void>;
  sendChannelMessage(content: string, mentionUserId?: string): Promise<void>;
}

export type DiscordClientConfig = {
  botToken?: string;
  webhookUrl?: string;
};

type Fetch = typeof fetch;

const API = 'https://discord.com/api/v10';

/**
 * A Discord client over the REST API: direct messages through a bot, channel posts through a webhook.
 *
 * Errors are reported by rejecting; callers decide whether that matters.
 */
export class DiscordClient implements IDiscordClient {
  private readonly dmChannels: Map<string, string> = new Map();

  constructor(private readonly config: DiscordClientConfig, private readonly fetchImpl: Fetch = fetch) {}

  public static fromEnvironment(fetchImpl?: Fetch): DiscordClient {
    return new DiscordClient({
      botToken: process.env.DISCORD_BOT_TOKEN?.trim() || undefined,
      webhookUrl: process.env.DISCORD_WEBHOOK_URL?.trim() || undefined,
    }, fetchImpl);
  }

  public get dmAvailable(): boolean {
    return this.config.botToken !== undefined;
  }

  public get channelAvailable(): boolean {
    return this.config.webhookUrl !== undefined;
  }

  private async post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', ...headers},
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Discord ${response.status} ${response.statusText} for ${url.replace(/\/webhooks\/.*/, '/webhooks/…')}`);
    }
    const text = await response.text();
    return text.length === 0 ? undefined : JSON.parse(text);
  }

  private async dmChannel(userId: string): Promise<string> {
    const cached = this.dmChannels.get(userId);
    if (cached !== undefined) {
      return cached;
    }
    const channel = await this.post(`${API}/users/@me/channels`, {recipient_id: userId}, {Authorization: `Bot ${this.config.botToken}`}) as {id: string};
    this.dmChannels.set(userId, channel.id);
    return channel.id;
  }

  public async sendDirectMessage(userId: string, content: string): Promise<void> {
    if (this.config.botToken === undefined) {
      throw new Error('No Discord bot token is configured');
    }
    const channelId = await this.dmChannel(userId);
    await this.post(`${API}/channels/${channelId}/messages`, {
      content,
      allowed_mentions: {parse: []},
    }, {Authorization: `Bot ${this.config.botToken}`});
  }

  public async sendChannelMessage(content: string, mentionUserId?: string): Promise<void> {
    if (this.config.webhookUrl === undefined) {
      throw new Error('No Discord webhook is configured');
    }
    const text = mentionUserId === undefined ? content : `<@${mentionUserId}> ${content}`;
    await this.post(this.config.webhookUrl, {
      content: text,
      allowed_mentions: {users: mentionUserId === undefined ? [] : [mentionUserId]},
    });
  }
}
