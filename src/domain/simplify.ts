import type { Balances, Settlement } from './types';

export function simplifyDebts(balances: Balances): Settlement[] {
  const settlements: Settlement[] = [];

  const creditors = Object.entries(balances)
    .filter(([, b]) => b > 0.001)
    .map(([id, amount]) => ({ id, amount }));

  const debtors = Object.entries(balances)
    .filter(([, b]) => b < -0.001)
    .map(([id, amount]) => ({ id, amount: -amount }));

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];
    const amount = Math.min(creditor.amount, debtor.amount);
    const rounded = Math.round(amount * 100) / 100;
    if (rounded > 0) {
      settlements.push({ from: debtor.id, to: creditor.id, amount: rounded });
    }
    creditor.amount -= amount;
    debtor.amount -= amount;
    if (creditor.amount < 0.001) ci++;
    if (debtor.amount < 0.001) di++;
  }

  return settlements;
}
