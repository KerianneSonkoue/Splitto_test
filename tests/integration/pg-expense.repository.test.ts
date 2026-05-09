// tests/integration/pg-expense.repository.test.ts — Exo 4
// Tests d'integration sur une vraie base Postgres via Testcontainers.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PgExpenseRepository } from '../../src/infrastructure/pg-expense.repository';
import type { Expense } from '../../src/domain/types';

const __dirname = dirname(fileURLToPath(import.meta.url));

let container: StartedPostgreSqlContainer;
let pool: Pool;
let repo: PgExpenseRepository;

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

  await pool.query(
    `INSERT INTO groups (id, name, currency) VALUES ('g1', 'Vacances', 'EUR')`,
  );
  await pool.query(`
    INSERT INTO members (id, group_id, name, email) VALUES
      ('alice',   'g1', 'Alice',   'alice@test.com'),
      ('bob',     'g1', 'Bob',     'bob@test.com'),
      ('charlie', 'g1', 'Charlie', 'charlie@test.com')
  `);

  repo = new PgExpenseRepository(pool);
}, 60_000);

afterAll(async () => {
  await pool.end();
  await container.stop();
});

beforeEach(async () => {
  await pool.query('TRUNCATE expenses CASCADE');
});

function makeExpense(overrides: Partial<Expense> & { id: string }): Expense {
  return {
    groupId: 'g1',
    description: 'Restaurant',
    amount: 30,
    currency: 'EUR',
    paidBy: 'alice',
    paidAt: new Date('2024-06-01T12:00:00Z'),
    split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'charlie'] },
    createdAt: new Date('2024-06-01T12:00:00Z'),
    ...overrides,
  };
}

describe('PgExpenseRepository', () => {
  it('save puis findById retourne expense identique', async () => {
    const expense = makeExpense({ id: 'e1' });

    await repo.save(expense);
    const found = await repo.findById('e1');

    expect(found).not.toBeNull();
    expect(found!.id).toBe('e1');
    expect(found!.groupId).toBe('g1');
    expect(found!.description).toBe('Restaurant');
    expect(found!.amount).toBeCloseTo(30);
    expect(found!.currency).toBe('EUR');
    expect(found!.paidBy).toBe('alice');
    expect(found!.split).toEqual({ mode: 'equal', beneficiaries: ['alice', 'bob', 'charlie'] });
  });

  it('findByGroupId retourne uniquement les expenses du groupe demande', async () => {
    await pool.query(`INSERT INTO groups (id, name, currency) VALUES ('g2', 'Autre', 'USD')`);
    await pool.query(`INSERT INTO members (id, group_id, name, email) VALUES ('dave', 'g2', 'Dave', 'dave@test.com')`);

    const e1 = makeExpense({ id: 'e1', groupId: 'g1' });
    const e2 = makeExpense({ id: 'e2', groupId: 'g2', paidBy: 'dave', split: { mode: 'equal', beneficiaries: ['dave'] } });
    const e3 = makeExpense({ id: 'e3', groupId: 'g1', paidAt: new Date('2024-06-02T12:00:00Z') });

    await repo.save(e1);
    await repo.save(e2);
    await repo.save(e3);

    const g1Expenses = await repo.findByGroupId('g1');

    expect(g1Expenses).toHaveLength(2);
    expect(g1Expenses.map(e => e.id)).toContain('e1');
    expect(g1Expenses.map(e => e.id)).toContain('e3');
    expect(g1Expenses.map(e => e.id)).not.toContain('e2');

    await pool.query(`DELETE FROM groups WHERE id = 'g2'`);
  });

  it('findInDateRange filtre correctement avec bornes inclusives', async () => {
    const expenses = [
      makeExpense({ id: 'e1', paidAt: new Date('2024-01-01T00:00:00Z') }),
      makeExpense({ id: 'e2', paidAt: new Date('2024-06-15T00:00:00Z') }),
      makeExpense({ id: 'e3', paidAt: new Date('2024-12-31T00:00:00Z') }),
    ];
    for (const e of expenses) await repo.save(e);

    const results = await repo.findInDateRange(
      'g1',
      new Date('2024-01-01T00:00:00Z'),
      new Date('2024-06-15T00:00:00Z'),
    );

    expect(results.map(e => e.id)).toContain('e1');
    expect(results.map(e => e.id)).toContain('e2');
    expect(results.map(e => e.id)).not.toContain('e3');
  });

  it('la contrainte UNIQUE rejette un doublon exact', async () => {
    const expense = makeExpense({ id: 'e1' });
    const duplicate = makeExpense({ id: 'e2' });

    await repo.save(expense);

    await expect(repo.save(duplicate)).rejects.toThrow();
  });

  it('une transaction qui echoue rollback proprement (aucune ligne sauvegardee)', async () => {
    const expense1 = makeExpense({ id: 'e1' });
    const duplicate = makeExpense({ id: 'e2' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO expenses
           (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
        [
          expense1.id, expense1.groupId, expense1.description,
          expense1.amount, expense1.currency, expense1.paidBy,
          expense1.paidAt.toISOString(), expense1.split.mode,
          JSON.stringify(expense1.split),
        ],
      );
      await client.query(
        `INSERT INTO expenses
           (id, group_id, description, amount, currency, paid_by, paid_at, split_mode, split_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
        [
          duplicate.id, duplicate.groupId, duplicate.description,
          duplicate.amount, duplicate.currency, duplicate.paidBy,
          duplicate.paidAt.toISOString(), duplicate.split.mode,
          JSON.stringify(duplicate.split),
        ],
      );
      await client.query('COMMIT');
    } catch {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    const { rows } = await pool.query('SELECT * FROM expenses');
    expect(rows).toHaveLength(0);
  });
});
