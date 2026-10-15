// Graine du jeu de données d'une démo, portée par l'URL (`?seed=K7P2QX`) :
// recharger la page ou partager le lien redonne exactement les mêmes données
// (voir random.ts). Alphabet sans caractères ambigus (0/O, 1/I/L), comme les
// codes de liste des autres projets, pour qu'elle reste lisible à voix haute.
export const SEED_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const SEED_LENGTH = 6;
const SEED_PATTERN = /^[A-Za-z0-9-]{1,32}$/;

/** Seule source d'aléa non reproductible de l'app (tout le reste dérive de
 * la graine) : `randomValues` n'est injectable que pour les tests. */
export function randomSeed(randomValues: (count: number) => ArrayLike<number> = (count) => crypto.getRandomValues(new Uint32Array(count))): string {
  return Array.from(randomValues(SEED_LENGTH), (v) => SEED_CHARS[v % SEED_CHARS.length]).join("");
}

/** Accepte toute graine raisonnable saisie à la main dans l'URL (pas
 * seulement celles produites par randomSeed), mais rejette ce qui pourrait
 * finir non échappé dans le DOM ou gonfler l'URL. */
export function isValidSeed(value: string): boolean {
  return SEED_PATTERN.test(value);
}

/** Graine valide lue dans l'URL, ou null (absente ou invalide). */
export function readSeed(url: URL): string | null {
  const value = url.searchParams.get("seed");
  return value !== null && isValidSeed(value) ? value.toUpperCase() : null;
}
