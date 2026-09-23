import {expect} from 'chai';
import {ICustomStore} from '@/server/custom/store/ICustomStore';

/** The behavior every custom store implementation must share. */
export function describeCustomStoreSuite(name: string, factory: () => Promise<ICustomStore>, cleanup?: () => Promise<void>) {
  describe(name, () => {
    let store: ICustomStore;

    beforeEach(async () => {
      store = await factory();
      await store.initialize();
    });

    afterEach(async () => {
      await cleanup?.();
    });

    it('returns undefined for a missing key', async () => {
      expect(await store.get('presets', 'nope')).is.undefined;
    });

    it('lists an empty namespace', async () => {
      expect(await store.list('presets')).deep.eq([]);
    });

    it('round trips a value', async () => {
      await store.put('presets', 'tuesday', {name: 'Tuesday', nested: {a: [1, 2, 3]}});
      expect(await store.get('presets', 'tuesday')).deep.eq({name: 'Tuesday', nested: {a: [1, 2, 3]}});
    });

    it('overwrites a value', async () => {
      await store.put('presets', 'tuesday', {v: 1});
      await store.put('presets', 'tuesday', {v: 2});
      expect(await store.get('presets', 'tuesday')).deep.eq({v: 2});
      expect(await store.list('presets')).has.length(1);
    });

    it('lists every entry in a namespace only', async () => {
      await store.put('presets', 'a', 1);
      await store.put('presets', 'b', 'two');
      await store.put('cards', 'c', true);
      const entries = await store.list('presets');
      entries.sort((x, y) => x.key.localeCompare(y.key));
      expect(entries).deep.eq([{key: 'a', value: 1}, {key: 'b', value: 'two'}]);
    });

    it('deletes a value, and deleting a missing key is harmless', async () => {
      await store.put('presets', 'a', 1);
      await store.delete('presets', 'a');
      await store.delete('presets', 'a');
      expect(await store.get('presets', 'a')).is.undefined;
    });

    it('rejects an unsafe key', async () => {
      let error: unknown;
      try {
        await store.put('presets', '../escape', 1);
      } catch (e) {
        error = e;
      }
      expect(error).instanceOf(Error);
    });

    it('rejects an unsafe namespace', async () => {
      let error: unknown;
      try {
        await store.list('..');
      } catch (e) {
        error = e;
      }
      expect(error).instanceOf(Error);
    });
  });
}
