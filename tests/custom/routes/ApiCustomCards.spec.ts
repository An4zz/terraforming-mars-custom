import {expect} from 'chai';
import {ApiCustomCards, ApiCustomClientCards} from '@/server/custom/routes/ApiCustomCards';
import {CustomCardRegistry} from '@/server/custom/cards/CustomCardRegistry';
import {MemoryCustomStore} from '@/server/custom/store/MemoryCustomStore';
import {statusCode} from '@/common/http/statusCode';
import {MockRequest, MockResponse} from '../../routes/HttpMocks';
import {RouteTestScaffolding} from '../../routes/RouteTestScaffolding';
import {greenhouseGrid, outpostColony} from '../cards/fixtures';

describe('ApiCustomCards', () => {
  let req: MockRequest;
  let res: MockResponse;
  let scaffolding: RouteTestScaffolding;
  let registry: CustomCardRegistry;

  beforeEach(() => {
    registry = new CustomCardRegistry(new MemoryCustomStore());
    CustomCardRegistry.setInstance(registry);
    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
    scaffolding.url = '/api/custom/cards';
  });

  afterEach(() => {
    CustomCardRegistry.setInstance(undefined);
  });

  function reset(url = '/api/custom/cards') {
    req = new MockRequest();
    res = new MockResponse();
    scaffolding.req = req;
    scaffolding.url = url;
  }

  async function post(body: unknown): Promise<any> {
    const posting = scaffolding.post(ApiCustomCards.INSTANCE, res);
    await Promise.resolve().then(() => {
      req.emitString(JSON.stringify(body));
      req.emitter.emit('end');
    });
    await posting;
    return res.statusCode === statusCode.ok ? JSON.parse(res.content) : undefined;
  }

  it('lists nothing at first', async () => {
    await scaffolding.get(ApiCustomCards.INSTANCE, res);
    expect(JSON.parse(res.content)).deep.eq([]);
  });

  it('saves a card, deriving its id and author', async () => {
    scaffolding.ctx.user = {id: '1', username: 'drew', discriminator: '0'};
    const saved = await post({op: 'save', card: {...greenhouseGrid(), id: '', name: '  Greenhouse Grid  ', image: 'data:image/png;base64,AAAA'}});
    expect(res.statusCode).eq(statusCode.ok);
    expect(saved.id).eq('greenhouse-grid');
    expect(saved.name).eq('Greenhouse Grid');
    expect(saved.author).eq('drew');
    expect(registry.get('greenhouse-grid')?.cost).eq(10);

    reset();
    await scaffolding.get(ApiCustomCards.INSTANCE, res);
    const list = JSON.parse(res.content);
    expect(list).has.length(1);
    expect(list[0].image).is.undefined;

    reset('/api/custom/cards?full=1');
    await scaffolding.get(ApiCustomCards.INSTANCE, res);
    expect(JSON.parse(res.content)[0].image).eq('data:image/png;base64,AAAA');

    reset('/api/custom/cards?id=greenhouse-grid');
    await scaffolding.get(ApiCustomCards.INSTANCE, res);
    expect(JSON.parse(res.content).name).eq('Greenhouse Grid');

    reset('/api/custom/cards?id=nope');
    await scaffolding.get(ApiCustomCards.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('updates an existing card by id and refuses a colliding name', async () => {
    await registry.save(greenhouseGrid());
    await registry.save(outpostColony());
    const updated = await post({op: 'save', card: greenhouseGrid({cost: 12})});
    expect(updated.cost).eq(12);
    expect(registry.all()).has.length(2);

    reset();
    await post({op: 'save', card: greenhouseGrid({id: '', name: 'Outpost'})});
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('another workshop card');

    reset();
    await post({op: 'save', card: greenhouseGrid({id: 'ghost'})});
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('rejects invalid cards with every problem listed', async () => {
    await post({op: 'save', card: greenhouseGrid({id: '', name: 'Algae', cost: 99})});
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('already the name');
    expect(res.content).contains('cost must be');
    expect(registry.all()).is.empty;
  });

  it('previews without storing', async () => {
    const preview = await post({op: 'preview', card: greenhouseGrid({id: ''})});
    expect(preview.card.name).eq('Greenhouse Grid');
    expect(preview.card.module).eq('custom');
    expect(preview.card.cost).eq(10);
    expect(registry.all()).is.empty;
    reset();
    const colony = await post({op: 'preview', card: outpostColony()});
    expect(colony.colony.name).eq('Outpost');
  });

  it('deletes a card', async () => {
    await registry.save(greenhouseGrid());
    const deleted = await post({op: 'delete', id: 'greenhouse-grid'});
    expect(deleted).deep.eq({deleted: 'greenhouse-grid'});
    expect(registry.all()).is.empty;
    reset();
    await post({op: 'delete', id: 'greenhouse-grid'});
    expect(res.statusCode).eq(statusCode.notFound);
  });

  it('rejects bad bodies and operations', async () => {
    const posting = scaffolding.post(ApiCustomCards.INSTANCE, res);
    await Promise.resolve().then(() => {
      req.emitString('{oops');
      req.emitter.emit('end');
    });
    await posting;
    expect(res.statusCode).eq(statusCode.badRequest);
    reset();
    await post({op: 'fly'});
    expect(res.statusCode).eq(statusCode.badRequest);
  });

  it('serves the client manifest', async () => {
    await registry.save(greenhouseGrid());
    await registry.save(outpostColony());
    scaffolding.url = '/api/custom/client-cards';
    await scaffolding.get(ApiCustomClientCards.INSTANCE, res);
    const body = JSON.parse(res.content);
    expect(body.cards.map((c: any) => c.name)).deep.eq(['Greenhouse Grid']);
    expect(body.colonies.map((c: any) => c.name)).deep.eq(['Outpost']);
  });
});
