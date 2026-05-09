import { describe, it, expect } from 'vitest';
import { simplifyDebts } from '../../src/domain/simplify';

describe('simplifyDebts', () => {
  it('retourne une liste vide si tout le monde est a 0', () => {
    expect(simplifyDebts({ alice: 0, bob: 0, charlie: 0 })).toEqual([]);
  });

  it('retourne une liste vide pour un objet vide', () => {
    expect(simplifyDebts({})).toEqual([]);
  });

  it('regle une dette entre 2 personnes en 1 settlement', () => {
    const result = simplifyDebts({ a: 10, b: -10 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: 'b', to: 'a', amount: 10 });
  });

  it('simplifie 3 personnes en triangle en 1 seul settlement (pas 2)', () => {
    const result = simplifyDebts({ a: 10, b: 0, c: -10 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: 'c', to: 'a', amount: 10 });
  });

  it('4 personnes : 2 settlements minimum, pas 3', () => {
    const result = simplifyDebts({ a: 30, b: -20, c: -10, d: 0 });
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ from: 'b', to: 'a', amount: 20 });
    expect(result).toContainEqual({ from: 'c', to: 'a', amount: 10 });
  });

  it('gere un montant avec arrondi a 2 decimales', () => {
    const result = simplifyDebts({ alice: 66.67, bob: -33.33, charlie: -33.34 });
    expect(result).toHaveLength(2);
    const totalSettled = result.reduce((s, r) => s + r.amount, 0);
    expect(totalSettled).toBeCloseTo(66.67, 1);
  });

  it('arrondit le montant a 2 decimales avec Math.round (0.005 -> 0.01)', () => {
    const result = simplifyDebts({ a: 0.005, b: -0.005 });
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(0.01);
  });

  it('ignore les soldes proches de 0 dus aux arrondis flottants', () => {
    const epsilon = 0.0001;
    const result = simplifyDebts({ alice: epsilon, bob: -epsilon });
    expect(result).toHaveLength(0);
  });

  it('ne cree pas de settlement si le montant arrondi vaut 0', () => {
    const result = simplifyDebts({ a: 0.003, b: -0.003 });
    expect(result).toEqual([]);
  });
});
