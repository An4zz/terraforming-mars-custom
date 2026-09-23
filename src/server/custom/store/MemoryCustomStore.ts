import {JSONValue} from '@/common/Types';
import {CustomStoreEntry, ICustomStore, isValidStoreKey} from './ICustomStore';

/** An in-memory custom store, for tests. */
export class MemoryCustomStore implements ICustomStore {
  private data: Map<string, Map<string, JSONValue>> = new Map();

  public initialize(): Promise<void> {
    return Promise.resolve();
  }

  private namespace(namespace: string, key?: string): Map<string, JSONValue> {
    if (!isValidStoreKey(namespace)) {
      throw new Error('Invalid namespace ' + namespace);
    }
    if (key !== undefined && !isValidStoreKey(key)) {
      throw new Error('Invalid key ' + key);
    }
    let map = this.data.get(namespace);
    if (map === undefined) {
      map = new Map();
      this.data.set(namespace, map);
    }
    return map;
  }

  public get(namespace: string, key: string): Promise<JSONValue | undefined> {
    return Promise.resolve(this.namespace(namespace, key).get(key));
  }

  public list(namespace: string): Promise<Array<CustomStoreEntry>> {
    return Promise.resolve(Array.from(this.namespace(namespace).entries()).map(([key, value]) => ({key, value})));
  }

  public put(namespace: string, key: string, value: JSONValue): Promise<void> {
    this.namespace(namespace, key).set(key, JSON.parse(JSON.stringify(value)));
    return Promise.resolve();
  }

  public delete(namespace: string, key: string): Promise<void> {
    this.namespace(namespace, key).delete(key);
    return Promise.resolve();
  }
}
