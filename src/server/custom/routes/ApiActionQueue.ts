import * as responses from '@/server/server/responses';
import {Handler} from '@/server/routes/Handler';
import {Context} from '@/server/routes/IHandler';
import {Request} from '@/server/Request';
import {Response} from '@/server/Response';
import {RouteError} from '@/server/routes/RouteError';
import {readBody} from '@/server/routes/readBody';
import {IPlayer} from '@/server/IPlayer';
import {ActionQueueModel, ActionQueueRequest, QueuedAction, validateQueue} from '@/common/custom/QueuedAction';
import {ActionQueueRunner} from '../queue/ActionQueueRunner';

/**
 * Reads and changes a player's action queue.
 *
 * `GET api/custom/queue?id=<playerId>` returns the queue and what can be queued. `POST` sets,
 * pauses, resumes or clears it; a set or resume runs the queue at once if it is the player's turn.
 */
export class ApiActionQueue extends Handler {
  public static readonly INSTANCE = new ApiActionQueue();

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

  private model(player: IPlayer): ActionQueueModel {
    return {...player.actionQueue, options: ActionQueueRunner.options(player)};
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const player = await this.player(ctx);
    responses.writeJson(res, ctx, this.model(player));
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const body = await readBody(req);
    let request: Partial<ActionQueueRequest>;
    try {
      request = JSON.parse(body);
    } catch {
      throw RouteError.badRequest('Body is not JSON');
    }
    const player = await this.player(ctx);
    const state = player.actionQueue;
    switch (request.op) {
    case 'set': {
      const problem = validateQueue(request.queue);
      if (problem !== undefined) {
        throw RouteError.badRequest(problem);
      }
      state.queue = (request.queue as Array<QueuedAction>).map((item) => ({...item}));
      state.executed = [];
      state.paused = false;
      state.stoppedReason = undefined;
      state.undoCount = player.game.undoCount;
      break;
    }
    case 'pause':
      state.paused = true;
      break;
    case 'resume':
      state.paused = false;
      state.stoppedReason = undefined;
      state.undoCount = player.game.undoCount;
      break;
    case 'clear':
      state.queue = [];
      state.executed = [];
      state.paused = false;
      state.stoppedReason = undefined;
      break;
    default:
      throw RouteError.badRequest('Unknown operation');
    }
    if (request.op === 'set' || request.op === 'resume') {
      ActionQueueRunner.maybeRun(player);
    }
    responses.writeJson(res, ctx, this.model(player));
  }
}
