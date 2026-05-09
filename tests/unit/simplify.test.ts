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

  it('produit exactement 2 settlements grace au tri decroissant (paires 1-pour-1)', () => {
    const result = simplifyDebts({ a: 60, b: 40, c: -40, d: -60 });
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ from: 'd', to: 'a', amount: 60 });
    expect(result).toContainEqual({ from: 'c', to: 'b', amount: 40 });
  });

  it('matche le plus grand debiteur en premier meme si declare apres dans l objet', () => {
    const result = simplifyDebts({ a: 100, c: -40, b: -60 });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ from: 'b', to: 'a', amount: 60 });
    expect(result[1]).toEqual({ from: 'c', to: 'a', amount: 40 });
  });

  it('settlement partiel : le plus grand crediteur est rembourse en premier', () => {
    const result = simplifyDebts({ b: 20, a: 30, c: -50 });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ from: 'c', to: 'a', amount: 30 });
    expect(result[1]).toEqual({ from: 'c', to: 'b', amount: 20 });
  });

  it('le settlement utilise le minimum entre crediteur et debiteur (pas le maximum)', () => {
    const result = simplifyDebts({ a: 30, b: -20, c: -10 });
    const bSettlement = result.find(s => s.from === 'b');
    expect(bSettlement).toBeDefined();
    expect(bSettlement?.amount).toBe(20);
  });

  it('arrete la boucle quand les debiteurs sont epuises (credit > dette)', () => {
    const result = simplifyDebts({ a: 10, b: -5 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: 'b', to: 'a', amount: 5 });
  });

  it('arrete la boucle quand les crediteurs sont epuises (dette > credit)', () => {
    const result = simplifyDebts({ a: 5, b: -10 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: 'b', to: 'a', amount: 5 });
  });

  it('arrondit correctement par multiplication par 100 (0.125 -> 0.13)', () => {
    const result = simplifyDebts({ a: 0.125, b: -0.125 });
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(0.13);
  });
});
