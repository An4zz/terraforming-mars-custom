import {Pool} from 'pg';
import {JSONValue} from '@/common/Types';
import {CustomStoreEntry, ICustomStore, isValidStoreKey} from './ICustomStore';

/**
 * A custom store backed by a single `custom_kv` table in the game's PostgreSQL database.
 *
 * It opens its own small pool using the same `POSTGRES_HOST` connection string as the game database.
 */
export class PostgresCustomStore implements ICustomStore {
  private readonly client: Pool;

  constructor(pool?: Pool) {
    if (pool !== undefined) {
      this.client = pool;
    } else {
      const config = {connectionString: process.env.POSTGRES_HOST, max: 2};
      this.client = new Pool(config);
    }
  }

  public async initialize(): Promise<void> {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS custom_kv(
        namespace varchar not null,
        key varchar not null,
        value text not null,
        updated_time timestamp default now() not null,
        PRIMARY KEY (namespace, key));`);
  }

  private validate(namespace: string, key?: string) {
    if (!isValidStoreKey(namespace)) {
      throw new Error('Invalid namespace ' + namespace);
    }
    if (key !== undefined && !isValidStoreKey(key)) {
      throw new Error('Invalid key ' + key);
    }
  }

  public async get(namespace: string, key: string): Promise<JSONValue | undefined> {
    this.validate(namespace, key);
    const res = await this.client.query('SELECT value FROM custom_kv WHERE namespace = $1 AND key = $2', [namespace, key]);
    if (res.rowCount === 0) {
      return undefined;
    }
    return JSON.parse(res.rows[0].value);
  }

  public async list(namespace: string): Promise<Array<CustomStoreEntry>> {
    this.validate(namespace);
    const res = await this.client.query('SELECT key, value FROM custom_kv WHERE namespace = $1', [namespace]);
    return res.rows.map((row) => ({key: row.key, value: JSON.parse(row.value)}));
  }

  public async put(namespace: string, key: string, value: JSONValue): Promise<void> {
    this.validate(namespace, key);
    await this.client.query(
      `INSERT INTO custom_kv(namespace, key, value, updated_time) VALUES($1, $2, $3, now())
       ON CONFLICT (namespace, key) DO UPDATE SET value = $3, updated_time = now()`,
      [namespace, key, JSON.stringify(value)]);
  }

  public async delete(namespace: string, key: string): Promise<void> {
    this.validate(namespace, key);
    await this.client.query('DELETE FROM custom_kv WHERE namespace = $1 AND key = $2', [namespace, key]);
  }
}
