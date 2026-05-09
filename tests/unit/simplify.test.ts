import { describe, it, expect } from 'vitest';
import { simplifyDebts } from '../../src/domain/simplify';

describe('simplifyDebts', () => {
  it('retourne une liste vide si tout le monde est a 0', () => {
    expect(simplifyDebts({ alice: 0, bob: 0, charlie: 0 })).toEqual([]);
  });

  it('retourne une liste vide pour un objet vide', () => {
    expect(simplifyDebts({})).toEqual([]);
  });
});
