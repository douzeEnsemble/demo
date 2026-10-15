import type { DemoContext } from "../../apps";
import { escapeHtml } from "../../lib/dom";
import { formatLongDate, formatMoney, formatShortDate, plural } from "../../lib/format";
import { icons } from "../../lib/icons";
import { createRng } from "../../lib/random";
import { wireConfirmClick } from "../../lib/confirmClick";
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
  type ReservationError,
} from "./generator";

const RESERVATION_ERRORS: Record<ReservationError, string> = {
  closed: "Les réservations sont closes.",
  noName: "Indique le nom de la réservation.",
  nameTooLong: `${MAX_NAME_LENGTH} caractères maximum pour le nom.`,
  badEmail: "Adresse e-mail invalide.",
  noSeat: "Choisis au moins un menu.",
  noAdult: "Une réservation doit compter au moins un adulte.",
  tooManySeats: `${MAX_SEATS_PER_RESERVATION} couverts maximum par réservation.`,
  full: "Il ne reste pas assez de places.",
  badMenu: "Nombre de couverts invalide.",
};

export function mountBooking(root: HTMLElement, ctx: DemoContext): () => void {
  let state: BookingState = generateBooking(createRng(ctx.seed), ctx.today);
  let nextId = state.reservations.length + 1;
  const { event } = state;
  const open = isBookingOpen(state, ctx.today);

  root.innerHTML = `
    <section class="card event-card">
      <h2>${escapeHtml(event.title)}</h2>
      <ul class="event-facts">
        <li>${icons.calendar}<span>${formatLongDate(event.date)} à ${escapeHtml(event.time)}</span></li>
        <li>${icons.pin}<span>${escapeHtml(event.place)}</span></li>
        <li>${icons.users}<span>Organisé par ${escapeHtml(event.organizer)}</span></li>
      </ul>
      <div class="gauge" id="booking-gauge"></div>
      <p class="muted">Réservations ${open ? `ouvertes jusqu'au ${formatLongDate(event.deadline)}` : "closes"}.</p>
    </section>

    <section class="card">
      <h2>Réserver</h2>
      <form id="booking-form" class="booking-form">
        <div class="form-grid">
          <label>Nom<input name="name" type="text" maxlength="${MAX_NAME_LENGTH}" autocomplete="name" /></label>
          <label>E-mail (facultatif)<input name="email" type="email" autocomplete="email" /></label>
          <label>Téléphone (facultatif)<input name="phone" type="tel" autocomplete="tel" /></label>
        </div>
        <fieldset>
          <legend>Menus</legend>
          <ul class="menu-picker">
            ${state.menus
              .map(
                (m) => `
              <li>
                <label for="menu-${escapeHtml(m.id)}">${escapeHtml(m.label)} <span class="muted">${formatMoney(m.price)}</span></label>
                <input id="menu-${escapeHtml(m.id)}" data-menu="${escapeHtml(m.id)}" type="number" min="0" max="${MAX_SEATS_PER_RESERVATION}" step="1" value="0" inputmode="numeric" />
              </li>`,
              )
              .join("")}
          </ul>
        </fieldset>
        <fieldset>
          <legend>Allergies à signaler</legend>
          <div class="checkbox-row">
            ${ALLERGIES.map((a) => `<label class="inline-option"><input type="checkbox" name="allergy" value="${escapeHtml(a)}" />${escapeHtml(a)}</label>`).join("")}
          </div>
        </fieldset>
        <div class="form-footer">
          <span>Total : <strong id="booking-total">${formatMoney(0)}</strong></span>
          <button type="submit" class="btn primary" ${open ? "" : "disabled"}>Réserver</button>
        </div>
        <p class="form-message" id="booking-message" aria-live="polite" hidden></p>
      </form>
    </section>

    <section class="card">
      <h2>${icons.utensils} Pour la cuisine</h2>
      <ul class="kitchen" id="booking-kitchen"></ul>
      <p class="muted" id="booking-allergies"></p>
    </section>

    <section class="card">
      <div class="card-heading">
        <h2 id="booking-list-title"></h2>
        <span class="muted" id="booking-revenue"></span>
      </div>
      <ul class="reservation-list" id="booking-list"></ul>
    </section>
  `;

  const form = root.querySelector<HTMLFormElement>("#booking-form")!;
  const message = root.querySelector<HTMLElement>("#booking-message")!;
  const menuInputs = Array.from(form.querySelectorAll<HTMLInputElement>("input[data-menu]"));

  function formMenus(): Record<string, number> {
    // Un champ vidé à la main vaut 0 plutôt qu'une erreur.
    return Object.fromEntries(menuInputs.map((input) => [input.dataset.menu!, input.value === "" ? 0 : Number(input.value)]));
  }

  function showMessage(text: string, kind: "error" | "success"): void {
    message.textContent = text;
    message.className = `form-message ${kind}`;
    message.hidden = false;
  }

  function menusSummary(r: Reservation): string {
    return state.menus
      .filter((m) => r.menus[m.id])
      .map((m) => `${r.menus[m.id]} × ${escapeHtml(m.label)}`)
      .join(", ");
  }

  function reservationHtml(r: Reservation): string {
    const id = escapeHtml(r.id);
    return `
      <li class="reservation">
        <div class="reservation-main">
          <strong>${escapeHtml(r.name)}</strong>
          <span class="muted">${plural(reservationSeats(r), "couvert")} · ${formatMoney(reservationTotal(state, r.menus))} · réservé le ${formatShortDate(r.createdOn)}</span>
          <span class="reservation-menus">${menusSummary(r)}</span>
          ${r.email || r.phone ? `<span class="muted">${[r.email, r.phone].filter(Boolean).map(escapeHtml).join(" · ")}</span>` : ""}
          ${r.allergies.length ? `<span class="allergy-tags">${r.allergies.map((a) => `<span class="tag">${escapeHtml(a)}</span>`).join("")}</span>` : ""}
        </div>
        <div class="reservation-actions">
          <button type="button" class="btn small paid-toggle${r.paid ? " paid" : ""}" data-action="paid" data-id="${id}" aria-pressed="${r.paid}">
            ${r.paid ? `${icons.checkCircle}<span>Payé</span>` : `${icons.euro}<span>À régler</span>`}
          </button>
          <button type="button" class="icon-btn danger" data-action="cancel" data-id="${id}" aria-label="Annuler la réservation de ${escapeHtml(r.name)}">${icons.trash}</button>
        </div>
      </li>`;
  }

  function render(): void {
    const taken = seatsTaken(state);
    const percent = Math.round((taken / event.capacity) * 100);
    root.querySelector("#booking-gauge")!.innerHTML = `
      <div class="gauge-label"><strong>${plural(taken, "place réservée", "places réservées")}</strong> sur ${event.capacity} · ${plural(seatsLeft(state), "place restante", "places restantes")}</div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${event.capacity}" aria-valuenow="${taken}" aria-label="Taux de remplissage"><div class="bar-fill" style="width: ${percent}%"></div></div>`;

    const kitchen = kitchenSummary(state);
    root.querySelector("#booking-kitchen")!.innerHTML = kitchen.menus
      .map((row) => `<li><span>${escapeHtml(row.menu.label)}</span><strong>${row.count}</strong></li>`)
      .join("");
    root.querySelector("#booking-allergies")!.textContent = kitchen.allergies.length
      ? `Allergies signalées : ${kitchen.allergies.map((a) => `${a.allergy} (${a.count})`).join(", ")}.`
      : "Aucune allergie signalée.";

    const money = revenue(state);
    root.querySelector("#booking-list-title")!.textContent = `Réservations (${state.reservations.length})`;
    root.querySelector("#booking-revenue")!.textContent = `${formatMoney(money.collected)} encaissés sur ${formatMoney(money.expected)}`;
    const list = root.querySelector<HTMLElement>("#booking-list")!;
    list.innerHTML = state.reservations.length
      ? state.reservations.slice().reverse().map(reservationHtml).join("")
      : `<li class="empty-state">Aucune réservation pour l'instant.</li>`;
    list.querySelectorAll<HTMLButtonElement>("[data-action=cancel]").forEach((button) => {
      wireConfirmClick(button, {
        armedLabel: "Confirmer l'annulation",
        onConfirm: () => {
          state = cancelReservation(state, button.dataset.id!);
          render();
        },
      });
    });
  }

  form.addEventListener("input", () => {
    root.querySelector("#booking-total")!.textContent = formatMoney(reservationTotal(state, formMenus()));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const next = addReservation(
      state,
      {
        name: String(data.get("name")),
        email: String(data.get("email")),
        phone: String(data.get("phone")),
        menus: formMenus(),
        allergies: data.getAll("allergy").map(String),
      },
      ctx.today,
      `r${nextId}`,
    );
    if (typeof next === "string") {
      showMessage(RESERVATION_ERRORS[next], "error");
      return;
    }
    nextId++;
    state = next;
    const added = state.reservations[state.reservations.length - 1];
    form.reset();
    root.querySelector("#booking-total")!.textContent = formatMoney(0);
    render();
    showMessage(`Réservation de ${added.name} enregistrée (${plural(reservationSeats(added), "couvert")}).`, "success");
  });

  root.querySelector("#booking-list")!.addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-action=paid]");
    if (!button) return;
    state = togglePaid(state, button.dataset.id!);
    render();
  });

  render();
  return () => {};
}
