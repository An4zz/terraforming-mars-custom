import {expect} from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {FileCustomStore} from '@/server/custom/store/FileCustomStore';
import {describeCustomStoreSuite} from './customStoreSuite';

describe('FileCustomStore', () => {
  let root: string;

  const factory = () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-custom-store-'));
    return Promise.resolve(new FileCustomStore(root));
  };
  const cleanup = () => {
    fs.rmSync(root, {recursive: true, force: true});
    return Promise.resolve();
  };

  describeCustomStoreSuite('shared suite', factory, cleanup);

  it('stores one JSON file per key under the namespace folder', async () => {
    const store = await factory();
    await store.initialize();
    await store.put('presets', 'tuesday', {name: 'Tuesday'});
    const filename = path.join(root, 'presets', 'tuesday.json');
    expect(fs.existsSync(filename)).is.true;
    expect(JSON.parse(fs.readFileSync(filename).toString())).deep.eq({name: 'Tuesday'});
    await cleanup();
  });

  it('skips a corrupt file when listing', async () => {
    const store = await factory();
    await store.initialize();
    await store.put('presets', 'good', {ok: true});
    fs.writeFileSync(path.join(root, 'presets', 'bad.json'), '{not json');
    const entries = await store.list('presets');
    expect(entries).deep.eq([{key: 'good', value: {ok: true}}]);
    await cleanup();
  });
});
