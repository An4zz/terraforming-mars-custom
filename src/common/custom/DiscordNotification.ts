/** A player's Discord turn-notification settings, stored per player id. */
export type DiscordOptIn = {
  enabled: boolean;
  /** The Discord user snowflake to mention or message. */
  discordUserId: string;
  /** Where the message goes: a direct message from the bot, or a mention in the configured channel. */
  delivery: 'dm' | 'channel';
};

/** What the server tells the client about its Discord setup. */
export type DiscordNotificationStatus = {
  /** True when the server can send direct messages (a bot token is configured). */
  dmAvailable: boolean;
  /** True when the server can post to a channel (a webhook is configured). */
  channelAvailable: boolean;
  optIn: DiscordOptIn | undefined;
  /** The Discord id of the logged-in user, if any, to prefill the form. */
  sessionDiscordUserId: string | undefined;
};

export function isValidDiscordUserId(id: string): boolean {
  return /^[1-9][0-9]{4,24}$/.test(id);
}
