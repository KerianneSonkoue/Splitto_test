// tests/e2e/pages/HomePage.ts

import type { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly newGroupButton: Locator;
  readonly groupDialog: Locator;
  readonly groupNameInput: Locator;
  readonly groupCurrencySelect: Locator;
  readonly groupMembersTextarea: Locator;
  readonly createGroupButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newGroupButton = page.getByRole('button', { name: 'Nouveau groupe' });
    // aria-label="Créer un groupe"
    this.groupDialog = page.getByRole('dialog', { name: /Cr.er un groupe/ });
    this.groupNameInput = page.getByLabel('Nom du groupe');
    this.groupCurrencySelect = page.getByLabel('Devise');
    this.groupMembersTextarea = page.getByLabel(/Membres/);
    // Le bouton submit dans le dialog a pour texte "Créer"
    this.createGroupButton = page.getByRole('button', { name: /^Cr.er$/ });
  }

  async goto() {
    await this.page.goto('/');
  }

  async openNewGroupDialog() {
    await this.newGroupButton.click();
    await this.groupDialog.waitFor({ state: 'visible' });
  }

  async fillGroupForm(name: string, currency: string, members: string) {
    await this.groupNameInput.fill(name);
    await this.groupCurrencySelect.selectOption(currency);
    await this.groupMembersTextarea.fill(members);
  }

  async submitGroupForm() {
    await this.createGroupButton.click();
  }

  async clickGroupByName(name: string) {
    await this.page.getByRole('listitem').filter({ hasText: name }).click();
  }
}
