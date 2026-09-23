import dotenv from 'dotenv';
import {Pool} from 'pg';
import {PostgresCustomStore} from '@/server/custom/store/PostgresCustomStore';
import {describeCustomStoreSuite} from '../custom/store/customStoreSuite';

dotenv.config({path: 'tests/integration/.env', debug: true, quiet: true});

/*
 * Runs with `npm run test:integration` against the same test database as PostgreSQL.spec.ts.
 * See tests/integration/PostgreSQL.md for setup.
 */
describe('PostgresCustomStore', () => {
  let pool: Pool;

  describeCustomStoreSuite('shared suite',
    () => {
      pool = new Pool({
        user: 'tfmtest',
        database: 'tfmtest',
        host: 'localhost',
        password: process.env.POSTGRES_INTEGRATION_TEST_PASSWORD,
      });
      return Promise.resolve(new PostgresCustomStore(pool));
    },
    async () => {
      await pool.query('DROP TABLE IF EXISTS custom_kv');
      await pool.end();
    });
});
