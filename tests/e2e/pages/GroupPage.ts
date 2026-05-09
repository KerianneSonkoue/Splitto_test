// tests/e2e/pages/GroupPage.ts

import type { Page, Locator } from '@playwright/test';

export class GroupPage {
  readonly page: Page;
  readonly addExpenseButton: Locator;
  readonly expenseDialog: Locator;
  readonly descriptionInput: Locator;
  readonly amountInput: Locator;
  readonly paidBySelect: Locator;
  readonly addExpenseSubmitButton: Locator;
  readonly expensesTable: Locator;
  readonly balancesTable: Locator;
  readonly settlementsTable: Locator;

  constructor(page: Page) {
    this.page = page;
    // "Ajouter une dépense" avec accent
    this.addExpenseButton = page.getByRole('button', { name: /Ajouter une d.pense/ });
    this.expenseDialog = page.getByRole('dialog', { name: /Ajouter une d.pense/ });
    this.descriptionInput = page.getByLabel('Description');
    this.amountInput = page.getByLabel('Montant');
    // "Payé par" avec accent
    this.paidBySelect = page.getByLabel(/Pay. par/);
    this.addExpenseSubmitButton = this.expenseDialog.getByRole('button', { name: 'Ajouter' });
    // aria-label="Liste des dépenses"
    this.expensesTable = page.getByRole('table', { name: /Liste des d.penses/ });
    this.balancesTable = page.getByRole('table', { name: 'Soldes des membres' });
    // aria-label="Règlements"
    this.settlementsTable = page.getByRole('table', { name: /R.glements/ });
  }

  async openAddExpenseDialog() {
    await this.addExpenseButton.click();
    await this.expenseDialog.waitFor({ state: 'visible' });
  }

  async fillExpenseForm(description: string, amount: number, paidByName: string) {
    await this.descriptionInput.fill(description);
    await this.amountInput.fill(String(amount));
    await this.paidBySelect.selectOption({ label: paidByName });
  }

  async submitExpenseForm() {
    await this.addExpenseSubmitButton.click();
  }

  async getBalanceForMember(memberName: string): Promise<string> {
    const row = this.balancesTable
      .getByRole('row')
      .filter({ hasText: memberName });
    return row.locator('td:nth-child(2)').innerText();
  }

  async clickSettleButton(index = 0) {
    // "Régler" avec accent
    const settleButtons = this.page.getByRole('button', { name: /R.gler/ });
    await settleButtons.nth(index).click();
  }

  async getSettlementRowCount(): Promise<number> {
    const count = await this.settlementsTable.getByRole('row').count();
    return count - 1;
  }
}
