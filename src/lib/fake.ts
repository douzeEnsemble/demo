import type { Rng } from "./random";

// Réservoirs communs à toutes les démos (personnes, coordonnées). Les
// réservoirs propres à une seule démo (produits, plats, questions…) vivent
// dans son propre generator.ts, pour que chaque démo reste lisible seule.

// Stryker disable StringLiteral,ArrayDeclaration,ObjectLiteral: réservoir de données
// fictives — aucun test n'a de raison d'en vérifier le texte exact, seulement
// la forme des données produites (voir fake.test.ts).
export const FIRST_NAMES = [
  "Camille", "Léa", "Manon", "Chloé", "Emma", "Inès", "Jade", "Louise", "Alice", "Lina",
  "Sarah", "Julie", "Zoé", "Clara", "Anaïs", "Lucie", "Margaux", "Nina", "Rose", "Agathe",
  "Lucas", "Hugo", "Louis", "Gabriel", "Arthur", "Jules", "Adam", "Nathan", "Raphaël", "Léo",
  "Tom", "Théo", "Noah", "Paul", "Maxime", "Antoine", "Bastien", "Mathis", "Yanis", "Samuel",
  "Dominique", "Claude", "Sacha", "Charlie",
] as const;

export const LAST_NAMES = [
  "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau",
  "Simon", "Laurent", "Lefèvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier",
  "Morel", "Girard", "André", "Mercier", "Dupont", "Lambert", "Bonnet", "François", "Martinez", "Legrand",
  "Garnier", "Faure", "Rousseau", "Blanc", "Guérin", "Muller", "Henry", "Roussel", "Nicolas", "Perrin",
] as const;
// Stryker restore all

export interface Person {
  firstName: string;
  lastName: string;
}

export function fullName(person: Person): string {
  return `${person.firstName} ${person.lastName}`;
}

/** `count` personnes aux noms complets tous différents (au plus le nombre de
 * combinaisons possibles), pour qu'aucune démo n'affiche deux homonymes
 * parfaits qu'on ne pourrait pas distinguer. */
export function uniquePeople(rng: Rng, count: number): Person[] {
  const max = FIRST_NAMES.length * LAST_NAMES.length;
  const target = Math.min(count, max);
  const seen = new Set<string>();
  const people: Person[] = [];
  while (people.length < target) {
    const person = { firstName: rng.pick(FIRST_NAMES), lastName: rng.pick(LAST_NAMES) };
    const key = fullName(person);
    if (seen.has(key)) continue;
    seen.add(key);
    people.push(person);
  }
  return people;
}

/** `count` prénoms tous différents (au plus la taille du réservoir). */
export function uniqueFirstNames(rng: Rng, count: number): string[] {
  return rng.sample(FIRST_NAMES, count);
}

/** Retire accents et caractères hors [a-z0-9] : « Lefèvre » → « lefevre ». */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Adresse cohérente avec le nom, toujours sur un domaine réservé à la
 * documentation (RFC 2606) pour qu'aucune démo n'affiche une vraie adresse. */
export function emailFor(person: Person): string {
  return `${slugify(person.firstName)}.${slugify(person.lastName)}@example.org`;
}

/** Numéro de mobile français au format d'affichage habituel. */
export function mobilePhone(rng: Rng): string {
  const groups = Array.from({ length: 4 }, () => String(rng.int(0, 99)).padStart(2, "0"));
  return `0${rng.pick(["6", "7"])} ${groups.join(" ")}`;
}
