import * as responses from '@/server/server/responses';
import {Handler} from '@/server/routes/Handler';
import {Context} from '@/server/routes/IHandler';
import {Request} from '@/server/Request';
import {Response} from '@/server/Response';
import {RouteError} from '@/server/routes/RouteError';
import {readBody} from '@/server/routes/readBody';
import {GamePreset, GamePresetRequest, GamePresetSaveResponse, MAX_PRESETS} from '@/common/custom/GamePreset';
import {JSONValue} from '@/common/Types';
import {CustomStore} from '../store/CustomStore';
import {slugify} from '../store/ICustomStore';
import {validatePresetRequest} from '../presets/validatePreset';

export const PRESETS_NAMESPACE = 'presets';

/**
 * Lists, saves and deletes game presets.
 *
 * `GET` returns every preset, newest first. `POST` takes a `GamePresetRequest`.
 */
export class ApiPresets extends Handler {
  public static readonly INSTANCE = new ApiPresets();

  private constructor() {
    super();
  }

  private async list(): Promise<Array<GamePreset>> {
    const entries = await CustomStore.getInstance().list(PRESETS_NAMESPACE);
    const presets = entries.map((entry) => entry.value as unknown as GamePreset);
    presets.sort((a, b) => b.updatedAt - a.updatedAt);
    return presets;
  }

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    responses.writeJson(res, ctx, await this.list());
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const body = await readBody(req);
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw RouteError.badRequest('Body is not JSON');
    }
    const validation = validatePresetRequest(parsed);
    if (validation.errors.length > 0) {
      throw RouteError.badRequest(validation.errors.join('; '));
    }
    const request = parsed as GamePresetRequest;
    const store = CustomStore.getInstance();
    if (request.op === 'delete') {
      if (await store.get(PRESETS_NAMESPACE, request.id) === undefined) {
        throw RouteError.notFound('No preset ' + request.id);
      }
      await store.delete(PRESETS_NAMESPACE, request.id);
      responses.writeJson(res, ctx, {deleted: request.id});
      return;
    }

    const name = request.name.trim();
    const id = slugify(name);
    const existing = await store.get(PRESETS_NAMESPACE, id);
    if (existing === undefined) {
      const count = (await store.list(PRESETS_NAMESPACE)).length;
      if (count >= MAX_PRESETS) {
        throw RouteError.badRequest(`At most ${MAX_PRESETS} presets can be stored`);
      }
    }
    const config = {...request.config};
    // A preset is a recipe, not a replay: the seed and clone id are per game.
    delete (config as Partial<typeof config>).clonedGamedId;
    const preset: GamePreset = {
      id,
      name,
      description: request.description?.trim() || undefined,
      author: ctx.user?.global_name ?? ctx.user?.username,
      updatedAt: ctx.clock.now(),
      config,
    };
    await store.put(PRESETS_NAMESPACE, id, preset as unknown as JSONValue);
    const response: GamePresetSaveResponse = {preset, warnings: validation.warnings};
    responses.writeJson(res, ctx, response);
  }
}
