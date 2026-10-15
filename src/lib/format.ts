// Dates manipulées comme chaînes ISO locales (« 2026-10-15 ») plutôt que des
// Date : un jeu de données reste ainsi identique quel que soit le fuseau du
// navigateur, et se compare/trie directement en tant que chaîne.

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Nombre de jours entiers de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000);
}

const SHORT_DATE = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const LONG_DATE = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** « jeu. 15 oct. » */
export function formatShortDate(iso: string): string {
  return SHORT_DATE.format(parseIsoDate(iso));
}

/** « jeudi 15 octobre 2026 » */
export function formatLongDate(iso: string): string {
  return LONG_DATE.format(parseIsoDate(iso));
}

const MONEY = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Montants toujours manipulés en centimes entiers (jamais de flottants
 * d'euros qui accumuleraient des erreurs d'arrondi dans les totaux). */
export function formatMoney(cents: number): string {
  return MONEY.format(cents / 100);
}

const INTEGER = new Intl.NumberFormat("fr-FR");

export function formatNumber(value: number): string {
  return INTEGER.format(value);
}

/** « 1 place », « 3 places » — le pluriel par défaut ajoute simplement « s ». */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${Math.abs(count) >= 2 ? pluralForm : singular}`;
}

/** Comparaison insensible à la casse et aux accents (« cafe » trouve « Café »). */
export function normalizeForSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
