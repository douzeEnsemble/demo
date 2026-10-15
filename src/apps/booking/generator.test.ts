import { describe, expect, it } from "vitest";
import { createRng } from "../../lib/random";
import { emailFor } from "../../lib/fake";
import {
  addReservation,
  ALLERGIES,
  cancelReservation,
  generateBooking,
  isBookingOpen,
  kitchenSummary,
  MAX_NAME_LENGTH,
  MAX_SEATS_PER_RESERVATION,
  reservationSeats,
  reservationTotal,
  revenue,
  seatsLeft,
  seatsTaken,
  togglePaid,
  type BookingState,
  type Reservation,
  type ReservationInput,
} from "./generator";

const TODAY = "2026-10-15";
const SEEDS = Array.from({ length: 30 }, (_, i) => `B${i}`);

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return { id: "r1", name: "Léa Martin", email: "", phone: "", menus: { m1: 2 }, allergies: [], createdOn: "2026-10-01", paid: false, ...overrides };
}

function booking(reservations: Reservation[] = [], capacity = 10): BookingState {
  return {
    event: { title: "Repas", date: "2026-11-01", time: "12 h 00", place: "Salle", organizer: "Comité", capacity, deadline: "2026-10-29" },
    menus: [
      { id: "m1", label: "Plat A", price: 2000, child: false },
      { id: "m2", label: "Plat B", price: 2000, child: false },
      { id: "enfant", label: "Menu enfant", price: 900, child: true },
    ],
    reservations,
  };
}

const input = (overrides: Partial<ReservationInput> = {}): ReservationInput => ({
  name: "Hugo Petit",
  email: "",
  phone: "",
  menus: { m1: 1, m2: 0, enfant: 0 },
  allergies: [],
  ...overrides,
});

describe("generateBooking", () => {
  it("est déterministe pour une graine donnée", () => {
    expect(generateBooking(createRng("A"), TODAY)).toEqual(generateBooking(createRng("A"), TODAY));
  });

  it("place l'événement dans le futur, avec une date limite avant l'événement, réservations ouvertes", () => {
    for (const seed of SEEDS) {
      const b = generateBooking(createRng(seed), TODAY);
      expect(b.event.date > TODAY).toBe(true);
      expect(b.event.deadline < b.event.date).toBe(true);
      expect(isBookingOpen(b, TODAY)).toBe(true);
      expect(b.event.capacity % 10).toBe(0);
    }
  });

  it("remplit entre 55 % et 90 % de la capacité, sans jamais la dépasser", () => {
    for (const seed of SEEDS) {
      const b = generateBooking(createRng(seed), TODAY);
      const ratio = seatsTaken(b) / b.event.capacity;
      expect(ratio).toBeGreaterThanOrEqual(0.5);
      expect(ratio).toBeLessThanOrEqual(0.9);
    }
  });

  it("produit des réservations cohérentes : au moins un adulte, menus connus, coordonnées dérivées du nom", () => {
    for (const seed of SEEDS) {
      const b = generateBooking(createRng(seed), TODAY);
      const adultIds = b.menus.filter((m) => !m.child).map((m) => m.id);
      expect(new Set(b.reservations.map((r) => r.name)).size).toBe(b.reservations.length);
      b.reservations.forEach((r, i) => {
        expect(adultIds.some((id) => r.menus[id] > 0)).toBe(true);
        for (const [id, count] of Object.entries(r.menus)) {
          expect(b.menus.map((m) => m.id)).toContain(id);
          expect(count).toBeGreaterThan(0);
        }
        const [firstName, ...rest] = r.name.split(" ");
        expect(r.email).toBe(emailFor({ firstName, lastName: rest.join(" ") }));
        expect(r.phone).toMatch(/^0[67]( \d{2}){4}$/);
        expect(r.createdOn <= TODAY).toBe(true);
        if (i > 0) expect(r.createdOn >= b.reservations[i - 1].createdOn).toBe(true);
        for (const a of r.allergies) expect(ALLERGIES).toContain(a);
      });
    }
  });

  it("fixe des prix ronds, le menu enfant moins cher que les menus adultes", () => {
    for (const seed of SEEDS) {
      const b = generateBooking(createRng(seed), TODAY);
      const child = b.menus.find((m) => m.child)!;
      for (const m of b.menus) expect(m.price % 50).toBe(0);
      for (const m of b.menus.filter((m) => !m.child)) expect(child.price).toBeLessThan(m.price);
    }
  });

  it("mélange réservations payées et à régler", () => {
    const all = SEEDS.flatMap((seed) => generateBooking(createRng(seed), TODAY).reservations);
    expect(all.some((r) => r.paid)).toBe(true);
    expect(all.some((r) => !r.paid)).toBe(true);
  });
});

describe("calculs", () => {
  const b = booking([reservation({ menus: { m1: 2, enfant: 1 }, paid: true }), reservation({ id: "r2", menus: { m2: 3 }, allergies: ["Gluten"] })]);

  it("compte les places", () => {
    expect(reservationSeats(b.reservations[0])).toBe(3);
    expect(seatsTaken(b)).toBe(6);
    expect(seatsLeft(b)).toBe(4);
  });

  it("calcule le total d'une réservation (menus absents = 0)", () => {
    expect(reservationTotal(b, { m1: 2, enfant: 1 })).toBe(4900);
    expect(reservationTotal(b, {})).toBe(0);
  });

  it("résume la cuisine : couverts par menu et allergies signalées seulement", () => {
    expect(kitchenSummary(b)).toEqual({
      menus: [
        { menu: b.menus[0], count: 2 },
        { menu: b.menus[1], count: 3 },
        { menu: b.menus[2], count: 1 },
      ],
      allergies: [{ allergy: "Gluten", count: 1 }],
    });
  });

  it("distingue le montant attendu de l'encaissé", () => {
    expect(revenue(b)).toEqual({ expected: 4900 + 6000, collected: 4900 });
  });
});

describe("addReservation", () => {
  it("ajoute une réservation nettoyée, non payée, datée du jour", () => {
    const next = addReservation(booking(), input({ name: "  Hugo   Petit ", email: " hugo@example.org ", phone: " 06 ", menus: { m1: 1, m2: 0, enfant: 2 }, allergies: ["Œufs", "Inconnue", "Gluten"] }), TODAY, "r7");
    expect(typeof next !== "string" && next.reservations).toEqual([
      { id: "r7", name: "Hugo Petit", email: "hugo@example.org", phone: "06", menus: { m1: 1, enfant: 2 }, allergies: ["Gluten", "Œufs"], createdOn: TODAY, paid: false },
    ]);
  });

  it("accepte de remplir exactement les places restantes", () => {
    expect(typeof addReservation(booking([], 3), input({ menus: { m1: 3 } }), TODAY, "r1")).not.toBe("string");
  });

  it("accepte une réservation le jour de la date limite, la refuse le lendemain", () => {
    expect(typeof addReservation(booking(), input(), "2026-10-29", "r1")).not.toBe("string");
    expect(addReservation(booking(), input(), "2026-10-30", "r1")).toBe("closed");
  });

  it("refuse les réservations invalides", () => {
    const b = booking([reservation({ menus: { m1: 8 } })]);
    expect(addReservation(b, input({ name: " " }), TODAY, "x")).toBe("noName");
    expect(addReservation(b, input({ name: "a".repeat(MAX_NAME_LENGTH + 1) }), TODAY, "x")).toBe("nameTooLong");
    expect(addReservation(b, input({ name: "a".repeat(MAX_NAME_LENGTH) }), TODAY, "x")).not.toBe("nameTooLong");
    expect(addReservation(b, input({ email: "pas-une-adresse" }), TODAY, "x")).toBe("badEmail");
    expect(addReservation(b, input({ menus: { m1: 0 } }), TODAY, "x")).toBe("noSeat");
    expect(addReservation(b, input({ menus: { enfant: 2 } }), TODAY, "x")).toBe("noAdult");
    expect(addReservation(b, input({ menus: { m1: 3 } }), TODAY, "x")).toBe("full");
    expect(addReservation(booking([], 50), input({ menus: { m1: MAX_SEATS_PER_RESERVATION + 1 } }), TODAY, "x")).toBe("tooManySeats");
    expect(addReservation(booking([], 50), input({ menus: { m1: MAX_SEATS_PER_RESERVATION } }), TODAY, "x")).not.toBe("tooManySeats");
    expect(addReservation(b, input({ menus: { m1: 1.5 } }), TODAY, "x")).toBe("badMenu");
    expect(addReservation(b, input({ menus: { m1: -1 } }), TODAY, "x")).toBe("badMenu");
    expect(addReservation(b, input({ menus: { inconnu: 1 } }), TODAY, "x")).toBe("badMenu");
  });
});

describe("cancelReservation / togglePaid", () => {
  it("annule une réservation par id", () => {
    const b = booking([reservation(), reservation({ id: "r2" })]);
    expect(cancelReservation(b, "r1").reservations.map((r) => r.id)).toEqual(["r2"]);
  });

  it("bascule le paiement de la seule réservation visée", () => {
    const b = booking([reservation(), reservation({ id: "r2" })]);
    const next = togglePaid(b, "r2");
    expect(next.reservations.map((r) => r.paid)).toEqual([false, true]);
    expect(togglePaid(next, "r2").reservations.map((r) => r.paid)).toEqual([false, false]);
  });
});
