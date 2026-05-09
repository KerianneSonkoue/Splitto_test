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
});
