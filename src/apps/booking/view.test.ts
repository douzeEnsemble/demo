// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRng } from "../../lib/random";
import * as generator from "./generator";
import { mountBooking } from "./view";

const ctx = { seed: "REPAS1", today: "2026-10-15" };
const spaces = (s: string | null) => s!.replace(/[  ]/g, " ");

function fixture(overrides: Partial<generator.BookingState["event"]> = {}): generator.BookingState {
  return {
    event: { title: "Repas <test>", date: "2026-11-07", time: "12 h 00", place: "Salle des fêtes", organizer: "Comité des fêtes", capacity: 10, deadline: "2026-11-04", ...overrides },
    menus: [
      { id: "m1", label: "Paella royale", price: 1500, child: false },
      { id: "m2", label: "Lasagnes maison", price: 1500, child: false },
      { id: "enfant", label: "Menu enfant", price: 700, child: true },
    ],
    reservations: [
      { id: "r1", name: "Léa Martin", email: "lea.martin@example.org", phone: "06 12 34 56 78", menus: { m1: 2, enfant: 1 }, allergies: ["Gluten"], createdOn: "2026-10-01", paid: true },
      { id: "r2", name: "Hugo Petit", email: "", phone: "", menus: { m2: 1 }, allergies: [], createdOn: "2026-10-05", paid: false },
    ],
  };
}

describe("mountBooking", () => {
  let root: HTMLElement;
  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    root = document.createElement("div");
    document.body.replaceChildren(root);
  });

  function fill(fields: { name?: string; email?: string; menus?: Record<string, string>; allergies?: string[] }): void {
    if (fields.name !== undefined) q<HTMLInputElement>("input[name=name]").value = fields.name;
    if (fields.email !== undefined) q<HTMLInputElement>("input[name=email]").value = fields.email;
    for (const [id, value] of Object.entries(fields.menus ?? {})) q<HTMLInputElement>(`#menu-${id}`).value = value;
    for (const allergy of fields.allergies ?? []) q<HTMLInputElement>(`input[name=allergy][value="${allergy}"]`).checked = true;
    q<HTMLFormElement>("#booking-form").dispatchEvent(new Event("input"));
  }

  it("affiche l'événement, les menus et les réservations générés pour la graine", () => {
    const state = generator.generateBooking(createRng(ctx.seed), ctx.today);
    mountBooking(root, ctx);
    expect(root.querySelector("h2")!.textContent).toBe(state.event.title);
    expect(root.querySelectorAll("input[data-menu]")).toHaveLength(state.menus.length);
    expect(root.querySelectorAll(".reservation")).toHaveLength(state.reservations.length);
    expect(q("#booking-gauge").textContent).toContain(`sur ${state.event.capacity}`);
  });

  it("affiche jauge, cuisine, encaissements et réservations (les plus récentes d'abord)", () => {
    vi.spyOn(generator, "generateBooking").mockReturnValue(fixture());
    mountBooking(root, ctx);
    expect(root.querySelector("h2")!.innerHTML).toBe("Repas &lt;test&gt;");
    expect(root.querySelector(".event-facts")!.textContent).toContain("samedi 7 novembre 2026 à 12 h 00");
    expect(q("#booking-gauge").textContent).toContain("4 places réservées sur 10 · 6 places restantes");
    expect(q(".bar-fill").style.width).toBe("40%");
    expect(q("#booking-kitchen").textContent).toContain("Paella royale2");
    expect(q("#booking-allergies").textContent).toBe("Allergies signalées : Gluten (1).");
    expect(spaces(q("#booking-revenue").textContent)).toBe("37,00 € encaissés sur 52,00 €");
    expect(q("#booking-list-title").textContent).toBe("Réservations (2)");
    const items = root.querySelectorAll(".reservation");
    expect(items[0].textContent).toContain("Hugo Petit");
    expect(items[0].textContent).toContain("1 couvert");
    expect(items[0].querySelector(".allergy-tags")).toBeNull();
    expect(items[1].textContent).toContain("2 × Paella royale, 1 × Menu enfant");
    expect(items[1].textContent).toContain("lea.martin@example.org · 06 12 34 56 78");
    expect(items[1].querySelector(".tag")!.textContent).toBe("Gluten");
    expect(items[1].querySelector(".paid-toggle")!.textContent).toContain("Payé");
    expect(root.textContent).toContain("Réservations ouvertes jusqu'au mercredi 4 novembre 2026.");
  });

  it("calcule le total au fil de la saisie (champ vide = 0)", () => {
    vi.spyOn(generator, "generateBooking").mockReturnValue(fixture());
    mountBooking(root, ctx);
    fill({ menus: { m1: "2", enfant: "1" } });
    expect(spaces(q("#booking-total").textContent)).toBe("37,00 €");
    fill({ menus: { m1: "" } });
    expect(spaces(q("#booking-total").textContent)).toBe("7,00 €");
  });

  it("enregistre une réservation et réinitialise le formulaire", () => {
    vi.spyOn(generator, "generateBooking").mockReturnValue(fixture());
    mountBooking(root, ctx);
    fill({ name: "Inès Roux", email: "ines@example.org", menus: { m2: "2", enfant: "1" }, allergies: ["Arachides"] });
    q<HTMLFormElement>("#booking-form").requestSubmit();
    expect(q("#booking-message").textContent).toBe("Réservation de Inès Roux enregistrée (3 couverts).");
    expect(q("#booking-message").className).toBe("form-message success");
    expect(q("#booking-gauge").textContent).toContain("7 places réservées");
    expect(root.querySelector(".reservation")!.textContent).toContain("Inès Roux");
    expect(root.querySelector(".reservation")!.textContent).toContain("À régler");
    expect(q("#booking-allergies").textContent).toContain("Arachides (1)");
    expect(q<HTMLInputElement>("input[name=name]").value).toBe("");
    expect(spaces(q("#booking-total").textContent)).toBe("0,00 €");
  });

  it("explique pourquoi une réservation est refusée", () => {
    vi.spyOn(generator, "generateBooking").mockReturnValue(fixture());
    mountBooking(root, ctx);
    fill({ name: "Inès", menus: { enfant: "2" } });
    q<HTMLFormElement>("#booking-form").requestSubmit();
    expect(q("#booking-message").textContent).toBe("Une réservation doit compter au moins un adulte.");
    expect(q("#booking-message").className).toBe("form-message error");
    fill({ menus: { m1: "7", enfant: "0" } });
    q<HTMLFormElement>("#booking-form").requestSubmit();
    expect(q("#booking-message").textContent).toBe("Il ne reste pas assez de places.");
  });

  it("bascule le paiement d'une réservation", () => {
    vi.spyOn(generator, "generateBooking").mockReturnValue(fixture());
    mountBooking(root, ctx);
    q<HTMLButtonElement>('[data-action=paid][data-id="r2"]').click();
    expect(q('[data-action=paid][data-id="r2"]').getAttribute("aria-pressed")).toBe("true");
    expect(spaces(q("#booking-revenue").textContent)).toBe("52,00 € encaissés sur 52,00 €");
    // Un clic ailleurs dans la liste ne fait rien.
    q(".reservation-main").click();
    expect(q('[data-action=paid][data-id="r2"]').getAttribute("aria-pressed")).toBe("true");
  });

  it("annule une réservation après confirmation au même endroit", () => {
    vi.spyOn(generator, "generateBooking").mockReturnValue(fixture());
    mountBooking(root, ctx);
    const cancel = () => q<HTMLButtonElement>('[data-action=cancel][data-id="r2"]');
    cancel().click();
    expect(cancel().classList.contains("confirm-armed")).toBe(true);
    expect(root.querySelectorAll(".reservation")).toHaveLength(2);
    cancel().click();
    expect(root.querySelectorAll(".reservation")).toHaveLength(1);
    q<HTMLButtonElement>('[data-action=cancel][data-id="r1"]').click();
    q<HTMLButtonElement>('[data-action=cancel][data-id="r1"]').click();
    expect(q("#booking-list").textContent).toContain("Aucune réservation pour l'instant.");
    expect(q("#booking-allergies").textContent).toBe("Aucune allergie signalée.");
  });

  it("désactive la réservation une fois la date limite passée", () => {
    vi.spyOn(generator, "generateBooking").mockReturnValue(fixture({ deadline: "2026-10-14" }));
    mountBooking(root, ctx);
    expect(q<HTMLButtonElement>("#booking-form button[type=submit]").disabled).toBe(true);
    expect(root.textContent).toContain("Réservations closes.");
  });

  it("renvoie un nettoyage sans effet", () => {
    expect(mountBooking(root, ctx)()).toBeUndefined();
  });
});
