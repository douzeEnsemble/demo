import { emailFor, fullName, mobilePhone, uniquePeople } from "../../lib/fake";
import { addDays, daysBetween } from "../../lib/format";
import type { Rng } from "../../lib/random";

export interface MealEvent {
  title: string;
  date: string;
  time: string;
  place: string;
  organizer: string;
  capacity: number;
  /** Dernier jour pour réserver (inclus). */
  deadline: string;
}

export interface Menu {
  id: string;
  label: string;
  price: number; // centimes
  /** Les menus enfant ne peuvent pas être réservés sans au moins un adulte. */
  child: boolean;
}

export interface Reservation {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** Nombre de couverts par id de menu (seuls les menus réservés figurent). */
  menus: Record<string, number>;
  allergies: string[];
  createdOn: string;
  paid: boolean;
}

export interface BookingState {
  event: MealEvent;
  menus: Menu[];
  /** Du plus ancien au plus récent. */
  reservations: Reservation[];
}

export const ALLERGIES = ["Gluten", "Lactose", "Arachides", "Fruits à coque", "Crustacés", "Œufs"] as const;
export const MAX_NAME_LENGTH = 60;
export const MAX_SEATS_PER_RESERVATION = 12;

interface Scenario {
  title: string;
  place: readonly string[];
  time: readonly string[];
  dishes: readonly string[];
  price: [number, number];
}

// Stryker disable StringLiteral,ArrayDeclaration,ObjectLiteral: réservoir de données
// fictives — aucun test n'a de raison d'en vérifier le texte exact, seulement
// la forme des données produites (voir generator.test.ts).
const SCENARIOS: readonly Scenario[] = [
  {
    title: "Repas de quartier",
    place: ["Salle des fêtes", "Cour de l'école Jean-Moulin", "Maison des associations"],
    time: ["12 h 00", "19 h 30"],
    dishes: ["Paella royale", "Couscous aux légumes (végétarien)", "Poulet basquaise", "Lasagnes maison"],
    price: [1200, 1800],
  },
  {
    title: "Dîner de gala du club",
    place: ["Château de la Roche", "Domaine des Tilleuls", "Salle Polyvalente"],
    time: ["19 h 30", "20 h 00"],
    dishes: ["Filet de bœuf, sauce aux morilles", "Dos de cabillaud, beurre blanc", "Risotto aux cèpes (végétarien)", "Suprême de volaille fermière"],
    price: [3200, 4800],
  },
  {
    title: "Déjeuner des aînés",
    place: ["Foyer municipal", "Restaurant scolaire", "Salle Saint-Exupéry"],
    time: ["12 h 00", "12 h 30"],
    dishes: ["Blanquette de veau", "Filet de colin, purée maison", "Gratin de légumes (végétarien)", "Pot-au-feu"],
    price: [1400, 2200],
  },
  {
    title: "Soirée choucroute de l'association",
    place: ["Salle des fêtes", "Gymnase du Parc", "Maison pour tous"],
    time: ["19 h 00", "19 h 30"],
    dishes: ["Choucroute garnie", "Choucroute de la mer", "Tarte flambée et salade (végétarien)"],
    price: [1600, 2400],
  },
];

const ORGANIZERS = ["Comité des fêtes", "Amicale des parents d'élèves", "Association Vivre Ensemble", "Club sportif municipal", "Conseil de quartier"] as const;
// Stryker restore all

/** Prix arrondi aux 50 centimes, comme sur une affiche. */
function roundPrice(cents: number): number {
  return Math.round(cents / 50) * 50;
}

export function reservationSeats(r: Reservation): number {
  return Object.values(r.menus).reduce((sum, n) => sum + n, 0);
}

export function seatsTaken(state: BookingState): number {
  return state.reservations.reduce((sum, r) => sum + reservationSeats(r), 0);
}

export function seatsLeft(state: BookingState): number {
  return state.event.capacity - seatsTaken(state);
}

export function reservationTotal(state: BookingState, menus: Record<string, number>): number {
  return state.menus.reduce((sum, m) => sum + (menus[m.id] ?? 0) * m.price, 0);
}

/**
 * Les réservations sont générées une à une jusqu'à un taux de remplissage
 * cible (jamais au-delà de la capacité), chacune avec des couverts adultes
 * et éventuellement enfants, un nom et des coordonnées cohérentes entre
 * eux, et une date de réservation entre l'ouverture et aujourd'hui. Les
 * réservations les plus anciennes ont plus de chances d'être déjà réglées.
 */
export function generateBooking(rng: Rng, today: string): BookingState {
  const scenario = rng.pick(SCENARIOS);
  const date = addDays(today, rng.int(10, 40));
  const capacity = rng.int(4, 9) * 10;
  const adultPrice = rng.int(...scenario.price);
  const dishes = rng.sample(scenario.dishes, Math.min(3, scenario.dishes.length));
  const menus: Menu[] = [
    ...dishes.map((label, i) => ({ id: `m${i + 1}`, label, price: roundPrice(adultPrice), child: false })),
    { id: "enfant", label: "Menu enfant (moins de 12 ans)", price: roundPrice(adultPrice * 0.45), child: true },
  ];
  const adultMenus = menus.filter((m) => !m.child);

  const event: MealEvent = {
    title: scenario.title,
    date,
    time: rng.pick(scenario.time),
    place: rng.pick(scenario.place),
    organizer: rng.pick(ORGANIZERS),
    capacity,
    deadline: addDays(date, -3),
  };

  const opening = addDays(today, -rng.int(15, 30));
  const openDays = daysBetween(opening, today);
  const target = Math.round(capacity * (0.55 + rng.next() * 0.35));
  // Assez de personnes distinctes pour le pire cas (une place par
  // réservation) : jamais deux réservations au même nom. Toutes ne
  // réservent pas : la boucle s'arrête de fait une fois la cible atteinte.
  const people = uniquePeople(rng, target);

  const reservations: Reservation[] = [];
  let taken = 0;
  for (const person of people) {
    const adults = rng.weighted([[1, 3], [2, 6], [3, 2], [4, 2]] as const);
    const children = rng.weighted([[0, 6], [1, 2], [2, 2], [3, 1]] as const);
    // Un groupe trop grand pour les places restantes est sauté (pas
    // d'arrêt) : des groupes plus petits peuvent encore compléter.
    if (taken + adults + children > target) continue;
    taken += adults + children;

    const reservationMenus: Record<string, number> = {};
    for (let i = 0; i < adults; i++) {
      const menu = rng.pick(adultMenus);
      reservationMenus[menu.id] = (reservationMenus[menu.id] ?? 0) + 1;
    }
    if (children) reservationMenus.enfant = children;

    const age = rng.int(0, openDays);
    reservations.push({
      id: `r${reservations.length + 1}`,
      name: fullName(person),
      email: emailFor(person),
      phone: mobilePhone(rng),
      menus: reservationMenus,
      allergies: rng.chance(0.2) ? rng.sample(ALLERGIES, rng.int(1, 2)) : [],
      createdOn: addDays(today, -age),
      paid: rng.chance(0.35 + (0.6 * age) / openDays),
    });
  }
  reservations.sort((a, b) => a.createdOn.localeCompare(b.createdOn));

  return { event, menus, reservations };
}

export interface ReservationInput {
  name: string;
  email: string;
  phone: string;
  menus: Record<string, number>;
  allergies: string[];
}

export type ReservationError = "closed" | "noName" | "nameTooLong" | "badEmail" | "noSeat" | "noAdult" | "tooManySeats" | "full" | "badMenu";

export function isBookingOpen(state: BookingState, today: string): boolean {
  return today <= state.event.deadline;
}

export function addReservation(state: BookingState, input: ReservationInput, today: string, id: string): BookingState | ReservationError {
  if (!isBookingOpen(state, today)) return "closed";
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name === "") return "noName";
  if (name.length > MAX_NAME_LENGTH) return "nameTooLong";
  const email = input.email.trim();
  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "badEmail";

  const menus: Record<string, number> = {};
  for (const [menuId, count] of Object.entries(input.menus)) {
    if (!Number.isInteger(count) || count < 0 || !state.menus.some((m) => m.id === menuId)) return "badMenu";
    if (count > 0) menus[menuId] = count;
  }
  const seats = Object.values(menus).reduce((sum, n) => sum + n, 0);
  if (seats === 0) return "noSeat";
  if (!state.menus.some((m) => !m.child && menus[m.id])) return "noAdult";
  if (seats > MAX_SEATS_PER_RESERVATION) return "tooManySeats";
  if (seats > seatsLeft(state)) return "full";

  const allergies = ALLERGIES.filter((a) => input.allergies.includes(a));
  const reservation: Reservation = { id, name, email, phone: input.phone.trim(), menus, allergies, createdOn: today, paid: false };
  return { ...state, reservations: [...state.reservations, reservation] };
}

export function cancelReservation(state: BookingState, id: string): BookingState {
  return { ...state, reservations: state.reservations.filter((r) => r.id !== id) };
}

export function togglePaid(state: BookingState, id: string): BookingState {
  return { ...state, reservations: state.reservations.map((r) => (r.id === id ? { ...r, paid: !r.paid } : r)) };
}

export interface KitchenSummary {
  /** Couverts par menu, dans l'ordre des menus. */
  menus: { menu: Menu; count: number }[];
  /** Nombre de réservations signalant chaque allergie (seules celles
   * signalées au moins une fois figurent). */
  allergies: { allergy: string; count: number }[];
}

export function kitchenSummary(state: BookingState): KitchenSummary {
  return {
    menus: state.menus.map((menu) => ({
      menu,
      count: state.reservations.reduce((sum, r) => sum + (r.menus[menu.id] ?? 0), 0),
    })),
    allergies: ALLERGIES.map((allergy) => ({
      allergy,
      count: state.reservations.filter((r) => r.allergies.includes(allergy)).length,
    })).filter((a) => a.count > 0),
  };
}

export function revenue(state: BookingState): { expected: number; collected: number } {
  let expected = 0;
  let collected = 0;
  for (const r of state.reservations) {
    const total = reservationTotal(state, r.menus);
    expected += total;
    if (r.paid) collected += total;
  }
  return { expected, collected };
}
