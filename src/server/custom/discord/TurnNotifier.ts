import {Clock} from '@/common/Timer';
import {DEFAULT_URL_ROOT} from '@/common/constants';
import {DiscordOptIn, isValidDiscordUserId} from '@/common/custom/DiscordNotification';
import {Phase} from '@/common/Phase';
import {PlayerId} from '@/common/Types';
import {JSONValue} from '@/common/Types';
import {IPlayer} from '@/server/IPlayer';
import {PlayerInput} from '@/server/PlayerInput';
import {paths} from '@/common/app/paths';
import {CustomStore} from '../store/CustomStore';
import {ICustomStore} from '../store/ICustomStore';
import {DiscordClient, IDiscordClient} from './DiscordClient';

export const DISCORD_NAMESPACE = 'discord';

/** How long after a player's own input their next prompt counts as part of the same sitting. */
export const RECENT_INPUT_MS = 30_000;
/** The shortest gap between two messages to the same player. */
export const RATE_LIMIT_MS = 30_000;

type PlayerState = {
  /** The prompt the player was last told about, so a reload of the same prompt stays quiet. */
  fingerprint?: string;
  lastInputAt?: number;
  lastNotifiedAt?: number;
};

/**
 * Tells opted-in players on Discord when a game waits on them.
 *
 * A player hears about a prompt once: not again when the same prompt is re-issued by a reload or
 * undo, not while they are actively playing (an input in the last 30 seconds), and never more
 * than once every 30 seconds. Sending never blocks the game; failures are logged.
 */
export class TurnNotifier {
  private static instance: TurnNotifier | undefined;

  public static getInstance(): TurnNotifier {
    if (TurnNotifier.instance === undefined) {
      TurnNotifier.instance = new TurnNotifier(DiscordClient.fromEnvironment());
    }
    return TurnNotifier.instance;
  }

  /** For testing: replaces the notifier. */
  public static setInstance(notifier: TurnNotifier | undefined): void {
    TurnNotifier.instance = notifier;
  }

  private readonly optIns: Map<PlayerId, DiscordOptIn> = new Map();
  private readonly states: Map<string, PlayerState> = new Map();
  /** Sends still in flight; tests await them. */
  public readonly pending: Array<Promise<void>> = [];

  constructor(
    public readonly client: IDiscordClient,
    private readonly clock: Clock = new Clock(),
    private readonly store: ICustomStore | undefined = undefined) {
  }

  private getStore(): ICustomStore {
    return this.store ?? CustomStore.getInstance();
  }

  /** Loads every stored opt-in. */
  public async initialize(): Promise<void> {
    const entries = await this.getStore().list(DISCORD_NAMESPACE);
    for (const entry of entries) {
      const optIn = entry.value as unknown as DiscordOptIn;
      if (optIn !== null && typeof optIn === 'object' && isValidDiscordUserId(optIn.discordUserId)) {
        this.optIns.set(entry.key as PlayerId, optIn);
      }
    }
    console.log(`Discord notifier: ${this.optIns.size} opt-ins, DM ${this.client.dmAvailable ? 'on' : 'off'}, channel ${this.client.channelAvailable ? 'on' : 'off'}.`);
  }

  public getOptIn(playerId: PlayerId): DiscordOptIn | undefined {
    return this.optIns.get(playerId);
  }

  public async setOptIn(playerId: PlayerId, optIn: DiscordOptIn): Promise<void> {
    this.optIns.set(playerId, optIn);
    await this.getStore().put(DISCORD_NAMESPACE, playerId, optIn as unknown as JSONValue);
  }

  public async clearOptIn(playerId: PlayerId): Promise<void> {
    this.optIns.delete(playerId);
    this.states.delete(playerId);
    await this.getStore().delete(DISCORD_NAMESPACE, playerId);
  }

  private state(player: IPlayer): PlayerState {
    let state = this.states.get(player.id);
    if (state === undefined) {
      state = {};
      this.states.set(player.id, state);
    }
    return state;
  }

  /** Records that `player` just answered a prompt. */
  public onInput(player: IPlayer): void {
    if (!this.optIns.has(player.id)) {
      return;
    }
    const state = this.state(player);
    state.lastInputAt = this.clock.now();
    state.fingerprint = undefined;
  }

  /** Considers telling `player` about `input`, which the game now waits on. */
  public onWaitingFor(player: IPlayer, input: PlayerInput): void {
    const optIn = this.optIns.get(player.id);
    if (optIn === undefined || !optIn.enabled) {
      return;
    }
    if (input.optional === true || player.game.phase === Phase.END) {
      return;
    }
    const game = player.game;
    const title = typeof input.title === 'string' ? input.title : input.title.message;
    const fingerprint = `${game.phase}:${game.generation}:${input.type}:${title}`;
    const state = this.state(player);
    if (state.fingerprint === fingerprint) {
      return;
    }
    state.fingerprint = fingerprint;
    const now = this.clock.now();
    if (state.lastInputAt !== undefined && now - state.lastInputAt < RECENT_INPUT_MS) {
      return;
    }
    if (state.lastNotifiedAt !== undefined && now - state.lastNotifiedAt < RATE_LIMIT_MS) {
      return;
    }
    state.lastNotifiedAt = now;
    this.send(player, optIn, `it's your turn in game ${game.id} (gen ${game.generation}): ${title} → ${this.playerLink(player)}`);
  }

  /** Sends `text` to `player` right away, ignoring the turn-based dedupe. Used for the action queue. */
  public notify(player: IPlayer, text: string): void {
    const optIn = this.optIns.get(player.id);
    if (optIn === undefined || !optIn.enabled) {
      return;
    }
    this.send(player, optIn, `${text} → ${this.playerLink(player)}`);
  }

  /** Sends a message that proves the opt-in works. Rejects when it could not be sent. */
  public sendTest(player: IPlayer, optIn: DiscordOptIn): Promise<void> {
    return this.deliver(optIn, `Discord notifications are on for game ${player.game.id} → ${this.playerLink(player)}`);
  }

  private playerLink(player: IPlayer): string {
    const root = (process.env.URL_ROOT || DEFAULT_URL_ROOT).replace(/\/$/, '');
    return `${root}/${paths.PLAYER}?id=${player.id}`;
  }

  private deliver(optIn: DiscordOptIn, text: string): Promise<void> {
    const content = `**Terraforming Mars** — ${text}`;
    if (optIn.delivery === 'dm') {
      return this.client.sendDirectMessage(optIn.discordUserId, content);
    }
    return this.client.sendChannelMessage(content, optIn.discordUserId);
  }

  private send(player: IPlayer, optIn: DiscordOptIn, text: string): void {
    const promise = this.deliver(optIn, text).catch((e) => {
      console.error(`Discord notification for ${player.id} failed:`, e instanceof Error ? e.message : e);
    });
    this.pending.push(promise);
    promise.finally(() => {
      const index = this.pending.indexOf(promise);
      if (index !== -1) {
        this.pending.splice(index, 1);
      }
    });
  }

  /** For testing: waits for every send in flight. */
  public async flush(): Promise<void> {
    await Promise.all([...this.pending]);
  }
}
