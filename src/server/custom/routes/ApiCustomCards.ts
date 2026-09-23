import * as responses from '@/server/server/responses';
import {Handler} from '@/server/routes/Handler';
import {Context} from '@/server/routes/IHandler';
import {Request} from '@/server/Request';
import {Response} from '@/server/Response';
import {RouteError} from '@/server/routes/RouteError';
import {readBody} from '@/server/routes/readBody';
import {CustomCardDefinition, MAX_CUSTOM_IMAGE_BYTES} from '@/common/custom/CustomCardDefinition';
import {CustomCardRegistry} from '../cards/CustomCardRegistry';
import {validateCustomCard} from '../cards/validateCustomCard';
import {slugify} from '../store/ICustomStore';

/** The body of a workshop request. */
export type CustomCardRequest =
  {op: 'save', card: CustomCardDefinition} |
  {op: 'delete', id: string} |
  {op: 'preview', card: CustomCardDefinition};

/** The largest request accepted: a card with its picture, with room to spare. */
const MAX_BODY_BYTES = MAX_CUSTOM_IMAGE_BYTES + 50_000;

function withoutImage(definition: CustomCardDefinition): CustomCardDefinition {
  const copy = {...definition};
  if (copy.image !== undefined) {
    copy.image = undefined;
  }
  return copy;
}

/**
 * Lists, saves, deletes and previews workshop cards.
 *
 * `GET api/custom/cards` lists definitions without pictures (`?full=1` includes them, `?id=` one
 * card). `POST` takes a `CustomCardRequest`; a preview returns the client card without storing.
 */
export class ApiCustomCards extends Handler {
  public static readonly INSTANCE = new ApiCustomCards();

  private constructor() {
    super();
  }

  public override get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const registry = CustomCardRegistry.getInstance();
    const id = ctx.urlParams.stringOrUndefined('id');
    if (id !== undefined) {
      const definition = registry.get(id);
      if (definition === undefined) {
        throw RouteError.notFound('No workshop card ' + id);
      }
      responses.writeJson(res, ctx, definition);
      return Promise.resolve();
    }
    const full = ctx.urlParams.stringOrUndefined('full') === '1';
    responses.writeJson(res, ctx, registry.all().map((d) => full ? d : withoutImage(d)));
    return Promise.resolve();
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const body = await readBody(req, MAX_BODY_BYTES);
    let request: Partial<CustomCardRequest>;
    try {
      request = JSON.parse(body);
    } catch {
      throw RouteError.badRequest('Body is not JSON');
    }
    const registry = CustomCardRegistry.getInstance();
    switch (request.op) {
    case 'delete': {
      if (typeof request.id !== 'string') {
        throw RouteError.badRequest('Missing id');
      }
      if (!await registry.remove(request.id)) {
        throw RouteError.notFound('No workshop card ' + request.id);
      }
      responses.writeJson(res, ctx, {deleted: request.id});
      return;
    }
    case 'save':
    case 'preview': {
      const input = request.card as Partial<CustomCardDefinition> | undefined;
      const existingId = typeof input?.id === 'string' && input.id.length > 0 ? input.id : undefined;
      if (request.op === 'save' && existingId !== undefined && registry.get(existingId) === undefined) {
        throw RouteError.notFound('No workshop card ' + existingId);
      }
      const errors = validateCustomCard(input, request.op === 'save' ? registry.takenNames(existingId) : new Set());
      if (errors.length > 0 || input === undefined) {
        throw RouteError.badRequest(errors.join('; '));
      }
      const definition: CustomCardDefinition = {
        ...(input as CustomCardDefinition),
        name: (input.name as string).trim(),
        id: request.op === 'save' ? (existingId ?? slugify(input.name as string)) : 'preview',
        author: input.author ?? ctx.user?.global_name ?? ctx.user?.username,
        updatedAt: ctx.clock.now(),
      };
      if (request.op === 'preview') {
        responses.writeJson(res, ctx, definition.kind === 'colony' ?
          {colony: CustomCardRegistry.clientColony(definition)} :
          {card: CustomCardRegistry.clientCard(definition)});
        return;
      }
      await registry.save(definition);
      responses.writeJson(res, ctx, definition);
      return;
    }
    default:
      throw RouteError.badRequest('Unknown operation');
    }
  }
}

/** Serves the compiled client cards and colonies for the client manifest. */
export class ApiCustomClientCards extends Handler {
  public static readonly INSTANCE = new ApiCustomClientCards();

  private constructor() {
    super();
  }

  public override get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const registry = CustomCardRegistry.getInstance();
    responses.writeJson(res, ctx, {cards: registry.clientCards(), colonies: registry.clientColonies()});
    return Promise.resolve();
  }
}
