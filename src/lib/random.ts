// Générateur pseudo-aléatoire déterministe à graine : toutes les données
// fictives des démos en dérivent. Une même graine (`?seed=` dans l'URL, voir
// seed.ts) redonne exactement le même jeu de données, ce qui rend une démo
// partageable/reproductible et les tests e2e déterministes — contrairement à
// Math.random(), qui ne se laisse pas initialiser.

export interface Rng {
  /** Flottant dans [0, 1[. */
  next(): number;
  /** Entier dans [min, max] (bornes incluses). */
  int(min: number, max: number): number;
  /** Vrai avec une probabilité `p` (0 ≤ p ≤ 1). */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Choix pondéré : chaque entrée a une chance proportionnelle à son poids. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  /** Copie mélangée (Fisher-Yates), sans toucher au tableau d'origine. */
  shuffle<T>(items: readonly T[]): T[];
  /** `count` éléments distincts (au plus la taille du tableau). */
  sample<T>(items: readonly T[], count: number): T[];
}

/** Hache une chaîne en entier 32 bits non signé (FNV-1a). */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 : minuscule, rapide, bien distribué pour de la démo (pas pour
 * de la cryptographie). */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): Rng {
  const next = mulberry32(hashString(seed));

  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: (items) => items[int(0, items.length - 1)],
    weighted: (entries) => {
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = next() * total;
      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll < 0) return value;
      }
      // Inatteignable sauf arrondi flottant sur la toute dernière borne.
      return entries[entries.length - 1][0];
    },
    shuffle,
    sample: (items, count) => shuffle(items).slice(0, count),
  };
}
