import * as responses from '@/server/server/responses';
import {Handler} from '@/server/routes/Handler';
import {Context} from '@/server/routes/IHandler';
import {Request} from '@/server/Request';
import {Response} from '@/server/Response';
import {RouteError} from '@/server/routes/RouteError';
import {readBody} from '@/server/routes/readBody';
import {IPlayer} from '@/server/IPlayer';
import {DiscordNotificationStatus, DiscordOptIn, isValidDiscordUserId} from '@/common/custom/DiscordNotification';
import {TurnNotifier} from '../discord/TurnNotifier';

type OptInRequest = {op: 'save', discordUserId: string, delivery: 'dm' | 'channel'} | {op: 'clear'} | {op: 'test'};

/**
 * Reads and changes a player's Discord turn notifications.
 *
 * `GET api/custom/discord?id=<playerId>` reports availability and the current opt-in. `POST`
 * saves, clears, or sends a test message.
 */
export class ApiDiscordOptIn extends Handler {
  public static readonly INSTANCE = new ApiDiscordOptIn();

  private constructor() {
    super();
  }

  private async player(ctx: Context): Promise<IPlayer> {
    const playerId = ctx.urlParams.playerId('id');
    const game = await ctx.gameLoader.getGame(playerId);
    if (game === undefined) {
      throw RouteError.notFound('cannot find game for that player');
    }
    try {
      return game.getPlayerById(playerId);
    } catch (err) {
      console.warn(`unable to find player ${playerId}`, err);
      throw RouteError.notFound('player not found');
    }
  }

  private status(player: IPlayer, ctx: Context): DiscordNotificationStatus {
    const notifier = TurnNotifier.getInstance();
    return {
      dmAvailable: notifier.client.dmAvailable,
      channelAvailable: notifier.client.channelAvailable,
      optIn: notifier.getOptIn(player.id),
      sessionDiscordUserId: ctx.user?.id,
    };
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const player = await this.player(ctx);
    responses.writeJson(res, ctx, this.status(player, ctx));
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const body = await readBody(req);
    let request: Partial<OptInRequest>;
    try {
      request = JSON.parse(body);
    } catch {
      throw RouteError.badRequest('Body is not JSON');
    }
    const player = await this.player(ctx);
    const notifier = TurnNotifier.getInstance();
    switch (request.op) {
    case 'save': {
      if (typeof request.discordUserId !== 'string' || !isValidDiscordUserId(request.discordUserId.trim())) {
        throw RouteError.badRequest('That is not a Discord user id');
      }
      if (request.delivery !== 'dm' && request.delivery !== 'channel') {
        throw RouteError.badRequest('Delivery must be dm or channel');
      }
      if (request.delivery === 'dm' && !notifier.client.dmAvailable) {
        throw RouteError.badRequest('This server cannot send direct messages');
      }
      if (request.delivery === 'channel' && !notifier.client.channelAvailable) {
        throw RouteError.badRequest('This server has no Discord channel configured');
      }
      const optIn: DiscordOptIn = {enabled: true, discordUserId: request.discordUserId.trim(), delivery: request.delivery};
      await notifier.setOptIn(player.id, optIn);
      break;
    }
    case 'clear':
      await notifier.clearOptIn(player.id);
      break;
    case 'test': {
      const optIn = notifier.getOptIn(player.id);
      if (optIn === undefined) {
        throw RouteError.badRequest('Turn on notifications first');
      }
      try {
        await notifier.sendTest(player, optIn);
      } catch (e) {
        throw RouteError.badRequest('Could not send: ' + (e instanceof Error ? e.message : String(e)));
      }
      break;
    }
    default:
      throw RouteError.badRequest('Unknown operation');
    }
    responses.writeJson(res, ctx, this.status(player, ctx));
  }
}
