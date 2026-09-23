import {FileCustomStore} from './FileCustomStore';
import {ICustomStore} from './ICustomStore';
import {PostgresCustomStore} from './PostgresCustomStore';

/**
 * The process-wide custom store, chosen the same way `Database` chooses its backend:
 * PostgreSQL when `POSTGRES_HOST` is set, JSON files under `db/custom` otherwise.
 */
export class CustomStore {
  private static instance: ICustomStore | undefined;

  private constructor() {}

  public static getInstance(): ICustomStore {
    if (CustomStore.instance === undefined) {
      CustomStore.instance = CustomStore.createInstance();
    }
    return CustomStore.instance;
  }

  /** For testing: replaces the store. */
  public static setInstance(store: ICustomStore | undefined): void {
    CustomStore.instance = store;
  }

  private static createInstance(): ICustomStore {
    if (process.env.POSTGRES_HOST !== undefined) {
      console.log('Custom store: PostgreSQL (custom_kv table).');
      return new PostgresCustomStore();
    }
    const root = process.env.CUSTOM_STORE_DIR;
    console.log('Custom store: JSON files' + (root ? ` in ${root}` : ' in db/custom') + '.');
    return new FileCustomStore(root);
  }
}
