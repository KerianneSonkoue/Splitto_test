// src/infrastructure/pg-expense.repository.ts
//
// EXERCICE 4 — Implémenté
//
// Implémentation Postgres du ExpenseRepository.

import type { Pool } from 'pg';
import type { Expense } from '../domain/types';
import type { ExpenseRepository } from '../ports/expense.repository';

export class PgExpenseRepository implements ExpenseRepository {
  constructor(private readonly pool: Pool) {}

  async save(expense: Expense): Promise<void> {
    await this.pool.query(
      `INSERT INTO expenses
         (id, group_id, description, amount, currency, paid_by, paid_at,
          split_mode, split_data, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
      [
        expense.id,
        expense.groupId,
        expense.description,
        expense.amount,
        expense.currency,
        expense.paidBy,
        expense.paidAt.toISOString(),
        expense.split.mode,
        JSON.stringify(expense.split),
        expense.category ?? null,
      ],
    );
  }

  async findById(id: string): Promise<Expense | null> {
    const { rows } = await this.pool.query(
      'SELECT * FROM expenses WHERE id = $1',
      [id],
    );
    return rows.length === 0 ? null : this.toExpense(rows[0]);
  }

  async findByGroupId(groupId: string): Promise<Expense[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM expenses WHERE group_id = $1 ORDER BY paid_at DESC',
      [groupId],
    );
    return rows.map(r => this.toExpense(r));
  }

  async findInDateRange(groupId: string, from: Date, to: Date): Promise<Expense[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM expenses
       WHERE group_id = $1
         AND paid_at >= $2
         AND paid_at <= $3
       ORDER BY paid_at DESC`,
      [groupId, from.toISOString(), to.toISOString()],
    );
    return rows.map(r => this.toExpense(r));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toExpense(row: any): Expense {
    return {
      id: row.id,
      groupId: row.group_id,
      description: row.description,
      amount: parseFloat(row.amount),
      currency: row.currency,
      paidBy: row.paid_by,
      paidAt: new Date(row.paid_at),
      split: row.split_data,
      createdAt: new Date(row.created_at),
      ...(row.category !== null && row.category !== undefined
        ? { category: row.category }
        : {}),
    };
  }
}
