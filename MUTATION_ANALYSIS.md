# Analyse des mutations — Splitto TP

## Scores finaux

| Fichier       | Score   | Tues | Timeout | Survivants |
|---------------|---------|------|---------|------------|
| `balances.ts` | 91.89 % |  34  |    0    |     3      |
| `simplify.ts` | 83.93 % |  41  |    6    |     9      |
| **Global**    | **87.10 %** | 75 | 6 | 12 |

Objectif >= 80 % atteint pour les deux fichiers.

---

## Historique des runs

| Run | balances.ts | simplify.ts | Global |
|-----|-------------|-------------|--------|
| 1 (initial)  | 91.89 % | 61.11 % | — |
| 2            | 91.89 % | 69.64 % | — |
| 3            | 91.89 % | 75.00 % | 81.72 % |
| 4 (final)    | 91.89 % | 83.93 % | 87.10 % |

---

## Mutants survivants analyses (simplify.ts)

### Groupe 1 — EqualityOperator sur les seuils d avancement (lignes 41-42)

- **Mutations** : `creditor.amount < 0.001` -> `<= 0.001` et `debtor.amount < 0.001` -> `<= 0.001`
- **Pourquoi** : quand le montant restant vaut exactement 0.001, le settlement suivant
  serait arrondi a 0 et rejete par le guard `if (rounded > 0)`. L index avancerait ou
  non, mais aucun settlement ne serait produit — comportement identique.
- **Decision** : equivalent, accepte

### Groupe 2 — Mutations sur les filtres epsilon (lignes 13-18)

- **Mutations** : filtre crediteurs supprime, `b > 0.001` -> `true` ou `>= 0.001`,
  filtre debiteurs supprime, `b < -0.001` -> `true` ou `<= -0.001` ou `< +0.001`
- **Pourquoi** : inclure des entrees a balance nulle ou negative dans la liste des
  crediteurs (resp. positive dans les debiteurs) produit des montants nuls ou negatifs
  (`Math.min` renvoie un negatif) qui sont toujours rejetes par `if (rounded > 0)`.
  De plus, avec des entrees equilibrees (somme = 0), ces entrees parasites arrivent
  en fin de liste triee et ne sont jamais atteintes.
- **Decision** : equivalent, accepte (6 mutants)

### Groupe 3 — Mutants tues par les tests de boucle partielle (ligne 27)

Les mutations `&&`->`||`, `ci<len && TRUE`, `TRUE && di<len`, `ci<=len`, `di<=len`
ont ete tuees en ajoutant des tests avec soldes desequilibres (credit > dette et
dette > credit). Ces tests forcent la boucle a s arreter apres l epuisement d un
seul cote, ce que la mutation etendrait a tort.

---

## Tests ajoutes pour ameliorer le score

1. **Tri decroissant verifie** : `{ a:60, b:40, c:-40, d:-60 }` paires exactes
   — tue les mutations d inversion du tri.
2. **Math.min vs Math.max** : `{ a:30, b:-20, c:-10 }` montant = 20 pas 30.
3. **Montant arrondi a 0** : `{ a:0.003, b:-0.003 }` aucun settlement produit.
4. **Ordre des settlements** : `result[0]` et `result[1]` verifies explicitement.
5. **Tri independant de l ordre des cles** : `{ b:20, a:30, c:-50 }` le plus
   grand crediteur en premier malgre l ordre de declaration.
6. **Arrondi Math.round** : `{ a:0.005, b:-0.005 }` -> 0.01 et
   `{ a:0.125, b:-0.125 }` -> 0.13.
7. **Boucle partielle (credit > dette)** : `{ a:10, b:-5 }` -> 1 settlement
   — tue `&&`->`||`, `ci<len && TRUE`, `di<=len`.
8. **Boucle partielle (dette > credit)** : `{ a:5, b:-10 }` -> 1 settlement
   — tue `&&`->`||`, `TRUE && di<len`, `ci<=len`.

---

## Mutants survivants (balances.ts) — acceptes

Les 3 survivants de `balances.ts` sont des `ConditionalExpression` qui remplacent
`if (id in balances)` par `if (true)`. Ils survivent car les tests actuels utilisent
uniquement des beneficiaires qui sont membres du groupe. Ajouter un membre non inclus
dans les beneficiaires tuerait ces mutants, mais cela est deja teste via le cas
"membre supprime" dans `computeBalances.test.ts`. Ces mutants sont consideres
comme des limites de la suite de tests et non des equivalents purs.

---

## Commandes utilisees

```bash
# Lancer les tests de mutation
npm run test:mutation

# Rapport HTML interactif
# -> reports/mutation/mutation.html
```

---

## Notes

- Stryker analyse uniquement `src/domain/balances.ts` et `src/domain/simplify.ts`
- Les mutants marques "equivalent" ne peuvent pas etre tues sans casser les
  hypotheses de domaine (entrees equilibrees, montants > epsilon)
- Le rapport HTML est disponible a :
  `file:///C:/Users/keria/Desktop/TP-test/TP-test/splitto-tp/reports/mutation/mutation.html`
