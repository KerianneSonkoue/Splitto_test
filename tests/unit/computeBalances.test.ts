import { describe, it, expect } from 'vitest';
import { computeBalances } from '../../src/domain/balances';
import type { Group, Expense } from '../../src/domain/types';

function makeGroup(memberIds: string[]): Group {
  return {
    id: 'g1',
    name: 'Trip',
    currency: 'EUR',
    members: memberIds.map(id => ({ id, name: id, email: `${id}@test.com` })),
  };
}

function makeExpense(overrides: Partial<Expense> & { id: string }): Expense {
  return {
    groupId: 'g1',
    description: 'Depense test',
    amount: 30,
    currency: 'EUR',
    paidBy: 'alice',
    paidAt: new Date('2024-01-01'),
    split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'charlie'] },
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

describe('computeBalances', () => {
  it('retourne un objet vide quand le groupe n a aucun membre', () => {
    const group = makeGroup([]);
    expect(computeBalances(group, [])).toEqual({});
  });

  it('repartit une depense equal entre 3 personnes (payeur inclus comme beneficiaire)', () => {
    const group = makeGroup(['alice', 'bob', 'charlie']);
    const expense = makeExpense({
      id: 'e1',
      amount: 30,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'charlie'] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances['alice']).toBeCloseTo(20);
    expect(balances['bob']).toBeCloseTo(-10);
    expect(balances['charlie']).toBeCloseTo(-10);
  });

  it('repartit une depense equal entre 3 personnes (payeur PAS beneficiaire)', () => {
    const group = makeGroup(['alice', 'bob', 'charlie']);
    const expense = makeExpense({
      id: 'e1',
      amount: 30,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['bob', 'charlie'] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances['alice']).toBeCloseTo(30);
    expect(balances['bob']).toBeCloseTo(-15);
    expect(balances['charlie']).toBeCloseTo(-15);
  });

  it('accumule plusieurs depenses qui se compensent partiellement', () => {
    const group = makeGroup(['alice', 'bob', 'charlie']);
    const expenses = [
      makeExpense({
        id: 'e1',
        amount: 30,
        paidBy: 'alice',
        split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'charlie'] },
      }),
      makeExpense({
        id: 'e2',
        amount: 15,
        paidBy: 'bob',
        split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'charlie'] },
      }),
    ];

    const balances = computeBalances(group, expenses);

    expect(balances['alice']).toBeCloseTo(15);
    expect(balances['bob']).toBeCloseTo(0);
    expect(balances['charlie']).toBeCloseTo(-15);
  });

  it('repartit une depense weighted avec poids non-uniformes', () => {
    const group = makeGroup(['alice', 'bob', 'charlie']);
    const expense = makeExpense({
      id: 'e1',
      amount: 30,
      paidBy: 'alice',
      split: { mode: 'weighted', weights: { alice: 2, bob: 1, charlie: 1 } },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances['alice']).toBeCloseTo(15);
    expect(balances['bob']).toBeCloseTo(-7.5);
    expect(balances['charlie']).toBeCloseTo(-7.5);
  });

  it('repartit une depense percentage avec arrondis (33.33+33.33+33.34=100)', () => {
    const group = makeGroup(['alice', 'bob', 'charlie']);
    const expense = makeExpense({
      id: 'e1',
      amount: 100,
      paidBy: 'alice',
      split: {
        mode: 'percentage',
        percentages: { alice: 33.33, bob: 33.33, charlie: 33.34 },
      },
    });

    const balances = computeBalances(group, [expense]);

    const total = balances['alice'] + balances['bob'] + balances['charlie'];
    expect(total).toBeCloseTo(0, 5);
    expect(balances['alice']).toBeCloseTo(66.67, 1);
    expect(balances['bob']).toBeCloseTo(-33.33, 1);
    expect(balances['charlie']).toBeCloseTo(-33.34, 1);
  });

  // Cas limites
  it('ignore un membre supprime reference dans une ancienne depense', () => {
    const group = makeGroup(['alice', 'bob']);
    const expense = makeExpense({
      id: 'e1',
      amount: 30,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'david'] },
    });

    const balances = computeBalances(group, [expense]);

    expect(Object.keys(balances)).not.toContain('david');
    expect(balances['alice']).toBeCloseTo(20);
    expect(balances['bob']).toBeCloseTo(-10);
  });

  it('initialise a 0 les soldes pour une liste de depenses vide', () => {
    const group = makeGroup(['alice', 'bob']);
    const balances = computeBalances(group, []);
    expect(balances).toEqual({ alice: 0, bob: 0 });
  });

  it('autorise une depense de 0 euro (soldes inchanges)', () => {
    const group = makeGroup(['alice', 'bob']);
    const expense = makeExpense({
      id: 'e1',
      amount: 0,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['alice', 'bob'] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances['alice']).toBeCloseTo(0);
    expect(balances['bob']).toBeCloseTo(0);
  });

  it('gere une depense dont le seul beneficiaire est le payeur', () => {
    const group = makeGroup(['alice', 'bob']);
    const expense = makeExpense({
      id: 'e1',
      amount: 50,
      paidBy: 'alice',
      split: { mode: 'equal', beneficiaries: ['alice'] },
    });

    const balances = computeBalances(group, [expense]);

    expect(balances['alice']).toBeCloseTo(0);
    expect(balances['bob']).toBeCloseTo(0);
  });

  it('gere plus de 10 membres correctement', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `m${i}`);
    const group = makeGroup(ids);
    const expense = makeExpense({
      id: 'e1',
      amount: 120,
      paidBy: 'm0',
      split: { mode: 'equal', beneficiaries: ids },
    });

    const balances = computeBalances(group, [expense]);

    const total = Object.values(balances).reduce((s, b) => s + b, 0);
    expect(total).toBeCloseTo(0, 5);
    expect(balances['m0']).toBeCloseTo(110);
    for (const id of ids.slice(1)) {
      expect(balances[id]).toBeCloseTo(-10);
    }
  });
});
