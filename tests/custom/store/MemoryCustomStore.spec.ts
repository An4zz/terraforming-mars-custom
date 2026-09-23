import {expect} from 'chai';
import {MemoryCustomStore} from '@/server/custom/store/MemoryCustomStore';
import {describeCustomStoreSuite} from './customStoreSuite';

describe('MemoryCustomStore', () => {
  describeCustomStoreSuite('shared suite', () => Promise.resolve(new MemoryCustomStore()));

  it('stores a copy, not the caller\'s object', async () => {
    const store = new MemoryCustomStore();
    const value = {count: 1};
    await store.put('ns', 'k', value);
    value.count = 2;
    expect(await store.get('ns', 'k')).deep.eq({count: 1});
  });
});
