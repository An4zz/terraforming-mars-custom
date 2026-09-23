import {IDiscordClient} from '@/server/custom/discord/DiscordClient';

export type SentMessage = {kind: 'dm' | 'channel', userId: string | undefined, content: string};

/** A Discord client that records what it would have sent. */
export class FakeDiscordClient implements IDiscordClient {
  public sent: Array<SentMessage> = [];
  public failNext = false;

  constructor(public dmAvailable = true, public channelAvailable = true) {}

  private maybeFail() {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('discord down'));
    }
    return Promise.resolve();
  }

  public async sendDirectMessage(userId: string, content: string): Promise<void> {
    await this.maybeFail();
    this.sent.push({kind: 'dm', userId, content});
  }

  public async sendChannelMessage(content: string, mentionUserId?: string): Promise<void> {
    await this.maybeFail();
    this.sent.push({kind: 'channel', userId: mentionUserId, content});
  }
}
