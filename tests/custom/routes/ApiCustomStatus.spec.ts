import {expect} from 'chai';
import {ApiCustomStatus} from '@/server/custom/routes/ApiCustomStatus';
import {CustomStore} from '@/server/custom/store/CustomStore';
import {MemoryCustomStore} from '@/server/custom/store/MemoryCustomStore';
import {statusCode} from '@/common/http/statusCode';
import {MockResponse} from '../../routes/HttpMocks';
import {RouteTestScaffolding} from '../../routes/RouteTestScaffolding';

describe('ApiCustomStatus', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    CustomStore.setInstance(new MemoryCustomStore());
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  afterEach(() => {
    CustomStore.setInstance(undefined);
  });

  it('reports the store and features', async () => {
    scaffolding.url = '/api/custom/status';
    await scaffolding.get(ApiCustomStatus.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.ok);
    expect(JSON.parse(res.content)).deep.eq({store: 'MemoryCustomStore', features: {presets: true, actionQueue: true, discordNotifications: false}});
  });

  it('rejects POST', async () => {
    scaffolding.url = '/api/custom/status';
    await scaffolding.post(ApiCustomStatus.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
  });
});
