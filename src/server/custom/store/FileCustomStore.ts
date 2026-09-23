import * as fs from 'fs';
import * as path from 'path';
import {JSONValue} from '@/common/Types';
import {CustomStoreEntry, ICustomStore, isValidStoreKey} from './ICustomStore';

/**
 * A custom store backed by JSON files: one folder per namespace, one file per key.
 *
 * Suitable for SQLite and local-filesystem deployments, where the game data already lives on disk.
 */
export class FileCustomStore implements ICustomStore {
  constructor(private readonly root: string = path.resolve(process.cwd(), 'db', 'custom')) {}

  public initialize(): Promise<void> {
    fs.mkdirSync(this.root, {recursive: true});
    return Promise.resolve();
  }

  private folder(namespace: string): string {
    if (!isValidStoreKey(namespace)) {
      throw new Error('Invalid namespace ' + namespace);
    }
    return path.resolve(this.root, namespace);
  }

  private filename(namespace: string, key: string): string {
    if (!isValidStoreKey(key)) {
      throw new Error('Invalid key ' + key);
    }
    return path.resolve(this.folder(namespace), key + '.json');
  }

  public get(namespace: string, key: string): Promise<JSONValue | undefined> {
    const filename = this.filename(namespace, key);
    if (!fs.existsSync(filename)) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(JSON.parse(fs.readFileSync(filename).toString()));
  }

  public list(namespace: string): Promise<Array<CustomStoreEntry>> {
    const folder = this.folder(namespace);
    if (!fs.existsSync(folder)) {
      return Promise.resolve([]);
    }
    const entries: Array<CustomStoreEntry> = [];
    for (const dirent of fs.readdirSync(folder, {withFileTypes: true})) {
      if (!dirent.isFile() || !dirent.name.endsWith('.json')) {
        continue;
      }
      try {
        const value = JSON.parse(fs.readFileSync(path.resolve(folder, dirent.name)).toString());
        entries.push({key: dirent.name.slice(0, -'.json'.length), value});
      } catch (e) {
        console.error(`While reading ${namespace}/${dirent.name}`, e);
      }
    }
    return Promise.resolve(entries);
  }

  public put(namespace: string, key: string, value: JSONValue): Promise<void> {
    const filename = this.filename(namespace, key);
    fs.mkdirSync(path.dirname(filename), {recursive: true});
    fs.writeFileSync(filename, JSON.stringify(value, undefined, 2));
    return Promise.resolve();
  }

  public delete(namespace: string, key: string): Promise<void> {
    const filename = this.filename(namespace, key);
    if (fs.existsSync(filename)) {
      fs.unlinkSync(filename);
    }
    return Promise.resolve();
  }
}
