import {expect} from 'chai';
import {ApiPresets} from '@/server/custom/routes/ApiPresets';
import {CustomStore} from '@/server/custom/store/CustomStore';
import {MemoryCustomStore} from '@/server/custom/store/MemoryCustomStore';
import {statusCode} from '@/common/http/statusCode';
import {DEFAULT_EXPANSIONS} from '@/common/cards/GameModule';
import {GamePreset, GamePresetRequest} from '@/common/custom/GamePreset';
import {NewGameConfig} from '@/common/game/NewGameConfig';
import {CardName} from '@/common/cards/CardName';
import {MockRequest, MockResponse} from '../../routes/HttpMocks';
import {RouteTestScaffolding} from '../../routes/RouteTestScaffolding';

function config(overrides: Partial<NewGameConfig> = {}): NewGameConfig {
  return {
    players: [{name: 'Alice', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: DEFAULT_EXPANSIONS,
    bannedCards: [],
    includedCards: [],
    clonedGamedId: 'g123',
    ...overrides,
  } as NewGameConfig;
}

describe('ApiPresets', () => {
  let req: MockRequest;
  let res: MockResponse;
  let scaffolding: RouteTestScaffolding;

  beforeEach(() => {
    CustomStore.setInstance(new MemoryCustomStore());
    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
    scaffolding.url = '/api/custom/presets';
  });

  afterEach(() => {
    CustomStore.setInstance(undefined);
  });

  async function post(body: unknown, response: MockResponse = res): Promise<MockResponse> {
    const posting = scaffolding.post(ApiPresets.INSTANCE, response);
    await Promise.resolve().then(() => {
      req.emitString(typeof body === 'string' ? body : JSON.stringify(body));
      req.emitter.emit('end');
    });
    await posting;
    return response;
  }

  async function list(): Promise<Array<GamePreset>> {
    const listRes = new MockResponse();
    await scaffolding.get(ApiPresets.INSTANCE, listRes);
    expect(listRes.statusCode).eq(statusCode.ok);
    return JSON.parse(listRes.content);
  }

  it('lists nothing at first', async () => {
    expect(await list()).deep.eq([]);
  });

  it('saves and lists a preset, stripping the cloned game id', async () => {
    const request: GamePresetRequest = {op: 'save', name: ' Tuesday rules ', description: 'No Turmoil', config: config()};
    await post(request);
    expect(res.statusCode).eq(statusCode.ok);
    const saved = JSON.parse(res.content);
    expect(saved.warnings).deep.eq([]);
    expect(saved.preset.id).eq('tuesday-rules');
    expect(saved.preset.name).eq('Tuesday rules');
    expect(saved.preset.description).eq('No Turmoil');
    expect(saved.preset.config.clonedGamedId).is.undefined;
    expect(saved.preset.config.players[0].name).eq('Alice');

    const presets = await list();
    expect(presets).has.length(1);
    expect(presets[0].id).eq('tuesday-rules');
  });

  it('overwrites a preset with the same name', async () => {
    await post({op: 'save', name: 'Tuesday', config: config({bannedCards: []})});
    req = new MockRequest();
    scaffolding = new RouteTestScaffolding(req);
    scaffolding.url = '/api/custom/presets';
    await post({op: 'save', name: 'tuesday', config: config({bannedCards: [CardName.ALGAE]})}, new MockResponse());
    const presets = await list();
    expect(presets).has.length(1);
    expect(presets[0].name).eq('tuesday');
    expect(presets[0].config.bannedCards).deep.eq(['Algae']);
  });

  it('records the logged-in user as the author', async () => {
    scaffolding.ctx.user = {id: '1', username: 'drew', discriminator: '0', global_name: 'Drew'};
    await post({op: 'save', name: 'Tuesday', config: config()});
    expect(JSON.parse(res.content).preset.author).eq('Drew');
  });

  it('returns warnings for unknown cards but still saves', async () => {
    await post({op: 'save', name: 'Tuesday', config: config({bannedCards: ['Nope' as CardName]})});
    expect(res.statusCode).eq(statusCode.ok);
    expect(JSON.parse(res.content).warnings[0]).contains('Unknown card name');
    expect(await list()).has.length(1);
  });

  it('rejects an invalid request', async () => {
    await post({op: 'save', name: '', config: config()});
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('Preset name must be');
    expect(await list()).deep.eq([]);
  });

  it('rejects a body that is not JSON', async () => {
    await post('{nope');
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).contains('not JSON');
  });

  it('rejects an oversized body', async () => {
    await post({op: 'save', name: 'Big', config: config({includedCards: new Array(20000).fill('Algae')})});
    expect(res.statusCode).eq(statusCode.contentTooLarge);
  });

  it('deletes a preset', async () => {
    await post({op: 'save', name: 'Tuesday', config: config()});
    req = new MockRequest();
    scaffolding = new RouteTestScaffolding(req);
    scaffolding.url = '/api/custom/presets';
    const deleteRes = await post({op: 'delete', id: 'tuesday'}, new MockResponse());
    expect(deleteRes.statusCode).eq(statusCode.ok);
    expect(JSON.parse(deleteRes.content)).deep.eq({deleted: 'tuesday'});
    expect(await list()).deep.eq([]);
  });

  it('reports a missing preset on delete', async () => {
    await post({op: 'delete', id: 'nothing'});
    expect(res.statusCode).eq(statusCode.notFound);
  });
});
