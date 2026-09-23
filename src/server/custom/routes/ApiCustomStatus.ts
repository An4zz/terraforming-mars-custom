import * as responses from '@/server/server/responses';
import {Handler} from '@/server/routes/Handler';
import {Context} from '@/server/routes/IHandler';
import {Request} from '@/server/Request';
import {Response} from '@/server/Response';
import {CustomStatusModel} from '@/common/custom/CustomStatusModel';
import {CustomStore} from '../store/CustomStore';
import {TurnNotifier} from '../discord/TurnNotifier';

/** Reports which custom features this server has enabled and how it stores their data. */
export class ApiCustomStatus extends Handler {
  public static readonly INSTANCE = new ApiCustomStatus();

  private constructor() {
    super();
  }

  public override get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const model: CustomStatusModel = {
      store: CustomStore.getInstance().constructor.name,
      features: {
        presets: true,
        actionQueue: true,
        discordNotifications: TurnNotifier.getInstance().client.dmAvailable || TurnNotifier.getInstance().client.channelAvailable,
      },
    };
    responses.writeJson(res, ctx, model);
    return Promise.resolve();
  }
}
