// src/domain/balances.ts — calcul des soldes d'un groupe
//
// EXERCICE 1 — IMPLÉMENTÉ
//
// Fonction PURE : pas d'effets de bord, pas d'I/O.
// Prend un groupe et ses dépenses, retourne les soldes par membre.

import type { Group, Expense, Balances } from './types';

export function computeBalances(group: Group, expenses: Expense[]): Balances {
  const balances: Balances = {};

  for (const member of group.members) {
    balances[member.id] = 0;
  }

  for (const expense of expenses) {
    // Le payeur est crédité du montant total
    if (expense.paidBy in balances) {
      balances[expense.paidBy] += expense.amount;
    }

    const { split } = expense;

    if (split.mode === 'equal') {
      const share = expense.amount / split.beneficiaries.length;
      for (const id of split.beneficiaries) {
        if (id in balances) balances[id] -= share;
      }
    } else if (split.mode === 'weighted') {
      const totalWeight = Object.values(split.weights).reduce((s, w) => s + w, 0);
      for (const [id, weight] of Object.entries(split.weights)) {
        if (id in balances) balances[id] -= (weight / totalWeight) * expense.amount;
      }
    } else {
      // percentage
      for (const [id, pct] of Object.entries(split.percentages)) {
        if (id in balances) balances[id] -= (pct / 100) * expense.amount;
      }
    }
  }

  return balances;
}
