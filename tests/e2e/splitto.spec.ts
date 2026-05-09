// tests/e2e/splitto.spec.ts — Exo 6 : 4 scenarios E2E avec Playwright
//
// - Page Object Model (HomePage, GroupPage)
// - Selecteurs semantiques uniquement (getByRole, getByLabel, getByTestId)
// - beforeEach appelle POST /_test/reset pour isolation totale
// - Aucun waitForTimeout

import { test, expect, type APIRequestContext } from '@playwright/test';
import { HomePage } from './pages/HomePage';
import { GroupPage } from './pages/GroupPage';

async function resetDb(request: APIRequestContext) {
  await request.post('/_test/reset');
}

async function createGroupViaApi(
  request: APIRequestContext,
  group: {
    id: string;
    name: string;
    currency: string;
    members: Array<{ id: string; name: string; email: string }>;
  },
) {
  await request.post('/api/groups', { data: group });
}

async function addExpenseViaApi(
  request: APIRequestContext,
  groupId: string,
  expense: {
    id: string;
    description: string;
    amount: number;
    currency: string;
    paidBy: string;
    paidAt: string;
    split: { mode: string; beneficiaries: string[] };
  },
) {
  await request.post(`/api/groups/${groupId}/expenses`, { data: expense });
}

test.beforeEach(async ({ request }) => {
  await resetDb(request);
});

test('Scenario 1 - Creer un groupe avec 3 membres via UI', async ({ page }) => {
  const home = new HomePage(page);
  await home.goto();

  await home.openNewGroupDialog();

  await home.fillGroupForm(
    'Vacances ete',
    'EUR',
    'Alice <alice@test.com>\nBob <bob@test.com>\nCharlie <charlie@test.com>',
  );

  await home.submitGroupForm();

  const listItem = page.getByRole('listitem').filter({ hasText: 'Vacances ete' });
  await expect(listItem).toBeVisible();
});

test('Scenario 2 - Ajouter une depense dans un groupe existant', async ({ page, request }) => {
  await createGroupViaApi(request, {
    id: 'g-s2',
    name: 'Coloc',
    currency: 'EUR',
    members: [
      { id: 'alice-s2', name: 'Alice', email: 'alice@test.com' },
      { id: 'bob-s2', name: 'Bob', email: 'bob@test.com' },
    ],
  });

  const home = new HomePage(page);
  await home.goto();
  await home.clickGroupByName('Coloc');

  const group = new GroupPage(page);
  await group.openAddExpenseDialog();
  await group.fillExpenseForm('Courses', 45, 'Alice');
  await group.submitExpenseForm();

  await expect(group.expensesTable).toBeVisible();
  await expect(group.expensesTable).toContainText('Courses');
  await expect(group.expensesTable).toContainText('45.00');
});

test('Scenario 3 - Verifier les soldes apres une depense de 30 euros', async ({ page, request }) => {
  await createGroupViaApi(request, {
    id: 'g-s3',
    name: 'Voyage',
    currency: 'EUR',
    members: [
      { id: 'alice-s3', name: 'Alice', email: 'alice@test.com' },
      { id: 'bob-s3', name: 'Bob', email: 'bob@test.com' },
      { id: 'charlie-s3', name: 'Charlie', email: 'charlie@test.com' },
    ],
  });

  await addExpenseViaApi(request, 'g-s3', {
    id: 'e-s3',
    description: 'Restaurant',
    amount: 30,
    currency: 'EUR',
    paidBy: 'alice-s3',
    paidAt: new Date().toISOString(),
    split: { mode: 'equal', beneficiaries: ['alice-s3', 'bob-s3', 'charlie-s3'] },
  });

  const home = new HomePage(page);
  await home.goto();
  await home.clickGroupByName('Voyage');

  const group = new GroupPage(page);
  await expect(group.balancesTable).toBeVisible();

  const aliceBalance = await group.getBalanceForMember('Alice');
  expect(aliceBalance).toContain('20.00');

  const bobBalance = await group.getBalanceForMember('Bob');
  expect(bobBalance).toContain('-10.00');

  const charlieBalance = await group.getBalanceForMember('Charlie');
  expect(charlieBalance).toContain('-10.00');
});

test('Scenario 4 - Marquer un reglement comme regle et verifier sa disparition', async ({ page, request }) => {
  await createGroupViaApi(request, {
    id: 'g-s4',
    name: 'Coloc2',
    currency: 'EUR',
    members: [
      { id: 'alice-s4', name: 'Alice', email: 'alice@test.com' },
      { id: 'bob-s4', name: 'Bob', email: 'bob@test.com' },
    ],
  });

  await addExpenseViaApi(request, 'g-s4', {
    id: 'e-s4',
    description: 'Loyer',
    amount: 40,
    currency: 'EUR',
    paidBy: 'alice-s4',
    paidAt: new Date().toISOString(),
    split: { mode: 'equal', beneficiaries: ['alice-s4', 'bob-s4'] },
  });

  const home = new HomePage(page);
  await home.goto();
  await home.clickGroupByName('Coloc2');

  const group = new GroupPage(page);
  await expect(group.settlementsTable).toBeVisible();
  const rowsBefore = await group.getSettlementRowCount();
  expect(rowsBefore).toBeGreaterThanOrEqual(1);

  await group.clickSettleButton(0);

  const rowsAfter = await group.getSettlementRowCount();
  expect(rowsAfter).toBe(rowsBefore - 1);
});
