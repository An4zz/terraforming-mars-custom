/** What the server reports about its custom features. */
export type CustomStatusModel = {
  /** The name of the custom store implementation in use. */
  store: string;
  features: {
    presets: boolean;
    actionQueue: boolean;
    workshop: boolean;
    /** True when the server can send Discord turn notifications. */
    discordNotifications: boolean;
  };
};
