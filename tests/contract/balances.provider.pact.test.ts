// tests/contract/balances.provider.pact.test.ts — Exo 5 (Provider)
// Verifie que splitto-api respecte le contrat genere par le consumer.

import { describe, it, beforeAll, afterAll } from 'vitest';
import { Verifier } from '@pact-foundation/pact';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../src/server';

const __dirname = dirname(fileURLToPath(import.meta.url));

let container: StartedPostgreSqlContainer;
let pool: Pool;
let serverUrl: string;
let httpServer: ReturnType<typeof createServer>;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();

  pool = new Pool({
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: container.getUsername(),
    password: container.getPassword(),
  });

  const sql = await readFile(
    join(__dirname, '..', '..', 'migrations', '001-initial.sql'),
    'utf8',
  );
  await pool.query(sql);

  const app = createApp(pool);
  httpServer = createServer(app);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = httpServer.address() as { port: number };
  serverUrl = `http://127.0.0.1:${addr.port}`;
}, 60_000);

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    httpServer.close(err => (err ? reject(err) : resolve()));
  });
  await pool.end();
  await container.stop();
});

describe('Verification du contrat Pact cote provider (splitto-api)', () => {
  it('satisfait le contrat genere par splitto-frontend', async () => {
    const pactFile = join(__dirname, '..', '..', 'pacts', 'splitto-frontend-splitto-api.json');

    await new Verifier({
      provider: 'splitto-api',
      providerBaseUrl: serverUrl,
      pactUrls: [pactFile],
      logLevel: 'warn',

      stateHandlers: {
        'group-1 a 3 membres et 2 depenses': async () => {
          await pool.query('TRUNCATE groups CASCADE');

          await pool.query(
            `INSERT INTO groups (id, name, currency) VALUES ('group-1', 'Vacances', 'EUR')`,
          );
          await pool.query(`
            INSERT INTO members (id, group_id, name, email) VALUES
              ('member-alice',   'group-1', 'Alice',   'alice@test.com'),
              ('member-bob',     'group-1', 'Bob',     'bob@test.com'),
              ('member-charlie', 'group-1', 'Charlie', 'charlie@test.com')
          `);
          await pool.query(`
            INSERT INTO expenses
              (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data)
            VALUES
              ('e1', 'group-1', 'Restaurant', 30, 'EUR', 'member-alice',
               '2024-06-01T12:00:00Z', 'equal',
               '{"mode":"equal","beneficiaries":["member-alice","member-bob","member-charlie"]}'::jsonb),
              ('e2', 'group-1', 'Transport', 30, 'EUR', 'member-alice',
               '2024-06-02T12:00:00Z', 'equal',
               '{"mode":"equal","beneficiaries":["member-alice","member-bob","member-charlie"]}'::jsonb)
          `);
        },

        'aucun groupe inexistant': async () => {
          await pool.query('TRUNCATE groups CASCADE');
        },
      },
    }).verifyProvider();
  }, 60_000);
});
