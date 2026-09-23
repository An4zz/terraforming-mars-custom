import {JSONValue} from '@/common/Types';

/** A single stored record: its key within a namespace and its JSON value. */
export type CustomStoreEntry = {
  key: string;
  value: JSONValue;
};

/**
 * A small namespaced key/value store for the fork's custom features (presets, workshop cards,
 * Discord opt-ins). It lives beside the game database so upstream database code stays untouched.
 */
export interface ICustomStore {
  /** Creates any folders or tables needed. */
  initialize(): Promise<void>;
  get(namespace: string, key: string): Promise<JSONValue | undefined>;
  /** Every entry in `namespace`, in no particular order. */
  list(namespace: string): Promise<Array<CustomStoreEntry>>;
  put(namespace: string, key: string, value: JSONValue): Promise<void>;
  delete(namespace: string, key: string): Promise<void>;
}

const KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

/** True when `key` is safe to use as a store key (and as a filename). */
export function isValidStoreKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/** Converts free text into a store key: lower case, dashes for anything else. */
export function slugify(text: string): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96);
  return slug.length === 0 ? 'item' : slug;
}
