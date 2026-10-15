import { uniqueFirstNames } from "../../lib/fake";
import { addDays } from "../../lib/format";
import type { Rng } from "../../lib/random";

export interface WheelEntry {
  id: string;
  label: string;
}

export interface Draw {
  winner: string;
  date: string;
}

export interface WheelState {
  title: string;
  entries: WheelEntry[];
  /** Tirages passés, du plus récent au plus ancien. */
  history: Draw[];
}

export const MAX_ENTRIES = 24;
export const MAX_LABEL_LENGTH = 40;
export const MAX_HISTORY = 20;

interface Scenario {
  title: string;
  /** Prénoms tirés au sort, ou liste fixe dans laquelle piocher. */
  entries: { people: [number, number] } | { pool: readonly string[]; count: [number, number] };
  /** Écart en jours entre deux tirages passés (cohérent avec la question :
   * hebdomadaire pour les croissants du vendredi, quotidien pour la
   * vaisselle…). */
  cadence: number;
}

// Stryker disable StringLiteral,ArrayDeclaration,ObjectLiteral: réservoir de données
// fictives — aucun test n'a de raison d'en vérifier le texte exact, seulement
// la forme des données produites (voir generator.test.ts).
const RESTAURANTS = [
  "Le Petit Zinc", "Chez Mamie Jo", "La Cantine du Marché", "Sushi Hana", "Pizzeria Bella", "Le Comptoir Thaï",
  "Burger & Co", "La Crêperie du Port", "Bistrot Saint-Jean", "Le Kebab d'Ali", "Green Bowl", "Taqueria Sol",
] as const;

const FILM_GENRES = [
  "Comédie", "Science-fiction", "Policier", "Animation", "Documentaire", "Horreur", "Comédie musicale", "Western", "Aventure", "Drame",
] as const;

const WEEKEND_ACTIVITIES = [
  "Randonnée", "Bowling", "Escape game", "Pique-nique", "Musée", "Accrobranche", "Cinéma", "Jeux de société", "Piscine", "Marché aux puces",
] as const;

const SCENARIOS: readonly Scenario[] = [
  { title: "Qui apporte les croissants vendredi ?", entries: { people: [6, 12] }, cadence: 7 },
  { title: "Qui fait la vaisselle ce soir ?", entries: { people: [3, 6] }, cadence: 1 },
  { title: "Qui anime la prochaine réunion d'équipe ?", entries: { people: [5, 10] }, cadence: 14 },
  { title: "Où déjeune-t-on ce midi ?", entries: { pool: RESTAURANTS, count: [5, 8] }, cadence: 1 },
  { title: "Quel genre de film ce soir ?", entries: { pool: FILM_GENRES, count: [5, 8] }, cadence: 7 },
  { title: "Quelle activité samedi ?", entries: { pool: WEEKEND_ACTIVITIES, count: [4, 8] }, cadence: 7 },
];
// Stryker restore all

export function generateWheel(rng: Rng, today: string): WheelState {
  const scenario = rng.pick(SCENARIOS);
  const labels =
    "people" in scenario.entries
      ? uniqueFirstNames(rng, rng.int(...scenario.entries.people))
      : rng.sample(scenario.entries.pool, rng.int(...scenario.entries.count));
  const entries = labels.map((label, i) => ({ id: `e${i + 1}`, label }));

  const history: Draw[] = Array.from({ length: rng.int(2, 6) }, (_, i) => ({
    winner: rng.pick(labels),
    date: addDays(today, -scenario.cadence * (i + 1)),
  }));

  return { title: scenario.title, entries, history };
}

/** Index du segment sous le pointeur (en haut de la roue) pour une rotation
 * donnée, en degrés dans le sens horaire. Le segment `i` couvre
 * [i × pas, (i + 1) × pas[ en partant du haut, dans le sens horaire. */
export function segmentAt(rotation: number, count: number): number {
  const step = 360 / count;
  const angleUnderPointer = (((-rotation % 360) + 360) % 360);
  return Math.floor(angleUnderPointer / step) % count;
}

export interface SpinPlan {
  winnerIndex: number;
  /** Rotation finale absolue (toujours supérieure à la rotation actuelle,
   * pour que la roue tourne toujours dans le même sens). */
  rotation: number;
}

export const MIN_TURNS = 5;
export const MAX_TURNS = 8;

/** Tire le gagnant puis calcule la rotation qui l'amène sous le pointeur —
 * dans cet ordre, pour que la probabilité soit exactement uniforme entre les
 * segments plutôt que dépendre d'un angle aléatoire arrondi. Le point
 * d'arrêt varie à l'intérieur du segment (jamais pile sur une frontière, où
 * le résultat serait visuellement ambigu). */
export function planSpin(rng: Rng, count: number, currentRotation: number): SpinPlan {
  const step = 360 / count;
  const winnerIndex = rng.int(0, count - 1);
  const angleInWheel = winnerIndex * step + step * (0.15 + 0.7 * rng.next());
  const landing = (360 - angleInWheel) % 360;
  const base = currentRotation - (((currentRotation % 360) + 360) % 360);
  return { winnerIndex, rotation: base + rng.int(MIN_TURNS, MAX_TURNS) * 360 + landing };
}

export type EntryError = "empty" | "tooLong" | "duplicate" | "full";

export function addEntry(state: WheelState, rawLabel: string, id: string): WheelState | EntryError {
  const label = rawLabel.trim();
  if (label === "") return "empty";
  if (label.length > MAX_LABEL_LENGTH) return "tooLong";
  if (state.entries.length >= MAX_ENTRIES) return "full";
  const key = label.toLocaleLowerCase("fr");
  if (state.entries.some((e) => e.label.toLocaleLowerCase("fr") === key)) return "duplicate";
  return { ...state, entries: [...state.entries, { id, label }] };
}

export function removeEntry(state: WheelState, id: string): WheelState {
  return { ...state, entries: state.entries.filter((e) => e.id !== id) };
}

/** Enregistre un tirage (en tête d'historique, plafonné) et retire
 * éventuellement le gagnant de la roue, pour enchaîner des tirages sans
 * remise (tombola, ordre de passage…). */
export function recordDraw(state: WheelState, winner: WheelEntry, date: string, removeWinner: boolean): WheelState {
  return {
    ...state,
    entries: removeWinner ? state.entries.filter((e) => e.id !== winner.id) : state.entries,
    history: [{ winner: winner.label, date }, ...state.history].slice(0, MAX_HISTORY),
  };
}

/** Teinte HSL du segment `index` : l'angle d'or (≈137,5°) espace au mieux
 * des couleurs voisines quel que soit le nombre de segments. */
export function segmentHue(index: number): number {
  return Math.round((index * 137.508 + 200) % 360);
}
