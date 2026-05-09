// tests/unit/expense.service.test.ts
// Exo 3 : les 5 types de doubles (taxonomie de Meszaros)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpenseService } from '../../src/domain/expense.service';
import type { ExpenseRepository } from '../../src/ports/expense.repository';
import type { EmailNotifier } from '../../src/ports/notifier';
import type { Clock } from '../../src/ports/clock';
import type { IdGenerator } from '../../src/ports/id-generator';
import type { Logger } from '../../src/ports/logger';
import type { Expense, CreateExpenseInput } from '../../src/domain/types';

// ─── DUMMY ──────────────────────────────────────────────────────────────────
// Passe en parametre mais les appels ne sont jamais verifies.
const dummyLogger: Logger = {
  info: () => {},
  error: () => {},
};

// ─── STUB ───────────────────────────────────────────────────────────────────
// Retourne des valeurs predefinies pour alimenter le SUT.
const FIXED_DATE = new Date('2024-06-15T12:00:00Z');
const FIXED_ID = 'expense-42';

const stubClock: Clock = {
  now: () => FIXED_DATE,
};

const stubIdGen: IdGenerator = {
  next: () => FIXED_ID,
};

// ─── FAKE ───────────────────────────────────────────────────────────────────
// Implementation fonctionnelle simplifiee (en memoire).
class FakeExpenseRepository implements ExpenseRepository {
  private readonly store: Expense[] = [];

  async save(expense: Expense): Promise<void> {
    this.store.push(expense);
  }

  async findById(id: string): Promise<Expense | null> {
    return this.store.find(e => e.id === id) ?? null;
  }

  async findByGroupId(groupId: string): Promise<Expense[]> {
    return this.store.filter(e => e.groupId === groupId);
  }

  async findInDateRange(groupId: string, from: Date, to: Date): Promise<Expense[]> {
    return this.store.filter(
      e => e.groupId === groupId && e.paidAt >= from && e.paidAt <= to,
    );
  }
}

// ─── SPY ────────────────────────────────────────────────────────────────────
// Enregistre les appels pour verification apres coup.
class SpyNotifier implements EmailNotifier {
  readonly calls: Array<{ groupId: string; message: string }> = [];

  async notifyGroupMembers(groupId: string, message: string): Promise<void> {
    this.calls.push({ groupId, message });
  }
}

// ─── MOCK ───────────────────────────────────────────────────────────────────
// Pre-programme avec des attentes verifiees en fin de test (vi.fn()).
const createMockNotifier = () => ({
  notifyGroupMembers: vi.fn<[string, string], Promise<void>>().mockResolvedValue(undefined),
});

// ─── Fixture ─────────────────────────────────────────────────────────────────
function makeInput(overrides: Partial<CreateExpenseInput> = {}): CreateExpenseInput {
  return {
    groupId: 'group-1',
    description: 'Restaurant',
    amount: 60,
    currency: 'EUR',
    paidBy: 'alice',
    paidAt: new Date('2024-06-01'),
    split: { mode: 'equal', beneficiaries: ['alice', 'bob', 'charlie'] },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ExpenseService.create()', () => {
  let fakeRepo: FakeExpenseRepository;
  let spyNotifier: SpyNotifier;

  beforeEach(() => {
    fakeRepo = new FakeExpenseRepository();
    spyNotifier = new SpyNotifier();
  });

  it('retourne une expense avec les bonnes valeurs (id et createdAt injectes)', async () => {
    const service = new ExpenseService(fakeRepo, spyNotifier, stubClock, stubIdGen, dummyLogger);
    const input = makeInput();

    const expense = await service.create(input);

    expect(expense.id).toBe(FIXED_ID);
    expect(expense.createdAt).toEqual(FIXED_DATE);
    expect(expense.description).toBe('Restaurant');
    expect(expense.amount).toBe(60);
    expect(expense.groupId).toBe('group-1');
  });

  it('persiste expense dans le repository (Fake)', async () => {
    const service = new ExpenseService(fakeRepo, spyNotifier, stubClock, stubIdGen, dummyLogger);

    await service.create(makeInput());

    const saved = await fakeRepo.findById(FIXED_ID);
    expect(saved).not.toBeNull();
    expect(saved?.id).toBe(FIXED_ID);
  });

  it('notifie le groupe quand le montant >= 100 (Spy)', async () => {
    const service = new ExpenseService(fakeRepo, spyNotifier, stubClock, stubIdGen, dummyLogger);

    await service.create(makeInput({ amount: 150, description: 'Vol Paris-NY' }));

    expect(spyNotifier.calls).toHaveLength(1);
    expect(spyNotifier.calls[0].groupId).toBe('group-1');
    expect(spyNotifier.calls[0].message).toContain('Vol Paris-NY');
  });

  it('ne notifie PAS le groupe quand le montant < 100 (Mock)', async () => {
    const mockNotifier = createMockNotifier();
    const service = new ExpenseService(fakeRepo, mockNotifier, stubClock, stubIdGen, dummyLogger);

    await service.create(makeInput({ amount: 60 }));

    expect(mockNotifier.notifyGroupMembers).not.toHaveBeenCalled();
  });

  it('notifie exactement une fois avec le bon groupId (Mock)', async () => {
    const mockNotifier = createMockNotifier();
    const service = new ExpenseService(fakeRepo, mockNotifier, stubClock, stubIdGen, dummyLogger);

    await service.create(makeInput({ amount: 200, description: 'Hotel' }));

    expect(mockNotifier.notifyGroupMembers).toHaveBeenCalledOnce();
    expect(mockNotifier.notifyGroupMembers).toHaveBeenCalledWith(
      'group-1',
      expect.stringContaining('Hotel'),
    );
  });

  it('le Fake repository retrouve une expense par groupId', async () => {
    const service = new ExpenseService(fakeRepo, spyNotifier, stubClock, stubIdGen, dummyLogger);
    await service.create(makeInput({ groupId: 'group-1' }));

    const expenses = await fakeRepo.findByGroupId('group-1');
    expect(expenses).toHaveLength(1);
    expect(expenses[0].id).toBe(FIXED_ID);
  });
});
