import type { DemoContext } from "../../apps";
import { escapeHtml } from "../../lib/dom";
import { formatShortDate } from "../../lib/format";
import { icons } from "../../lib/icons";
import { createRng } from "../../lib/random";
import {
  addEntry,
  generateWheel,
  MAX_ENTRIES,
  MAX_LABEL_LENGTH,
  planSpin,
  recordDraw,
  removeEntry,
  segmentHue,
  type EntryError,
  type WheelEntry,
  type WheelState,
} from "./generator";

/** Durée de l'animation, gardée en phase avec la transition CSS de
 * `.wheel-rotor` (style.css). */
export const SPIN_MS = 4500;

const RADIUS = 95;
const MAX_WHEEL_LABEL = 13;

const ENTRY_ERRORS: Record<EntryError, string> = {
  empty: "Saisis un nom avant de l'ajouter.",
  tooLong: `${MAX_LABEL_LENGTH} caractères maximum.`,
  duplicate: "Ce nom est déjà sur la roue.",
  full: `La roue est pleine (${MAX_ENTRIES} cases maximum).`,
};

function point(angle: number, radius: number): string {
  const rad = (angle * Math.PI) / 180;
  return `${(radius * Math.sin(rad)).toFixed(3)} ${(-radius * Math.cos(rad)).toFixed(3)}`;
}

function shortLabel(label: string): string {
  return label.length > MAX_WHEEL_LABEL ? `${label.slice(0, MAX_WHEEL_LABEL - 1)}…` : label;
}

export function wheelSvg(entries: readonly WheelEntry[]): string {
  if (entries.length < 2) {
    return `<circle r="${RADIUS}" class="wheel-empty"/><text class="wheel-empty-text" text-anchor="middle" dominant-baseline="middle">Ajoute au moins 2 cases</text>`;
  }
  // Au moins 2 cases : chaque segment fait au plus 180°, jamais besoin du
  // drapeau « grand arc » de la commande A du tracé SVG.
  const step = 360 / entries.length;
  const fontSize = Math.max(6, Math.min(9, 80 / entries.length + 2));
  return entries
    .map((entry, i) => {
      const start = i * step;
      const end = start + step;
      const mid = start + step / 2;
      return `
        <path d="M0 0 L${point(start, RADIUS)} A${RADIUS} ${RADIUS} 0 0 1 ${point(end, RADIUS)} Z" style="--hue: ${segmentHue(i)}" class="wheel-segment"/>
        <text transform="rotate(${mid - 90})" x="${RADIUS - 8}" y="0" font-size="${fontSize}" class="wheel-label" text-anchor="end" dominant-baseline="middle">${escapeHtml(shortLabel(entry.label))}</text>`;
    })
    .join("");
}

function prefersReducedMotion(): boolean {
  return (
    document.documentElement.hasAttribute("data-reduce-motion") ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export function mountWheel(root: HTMLElement, ctx: DemoContext): () => void {
  let state: WheelState = generateWheel(createRng(ctx.seed), ctx.today);
  let rotation = 0;
  let spinCount = 0;
  let spinning = false;
  let nextEntryId = state.entries.length + 1;
  let spinTimer: ReturnType<typeof setTimeout> | undefined;
  let removeWinner = false;

  root.innerHTML = `
    <section class="card wheel-card">
      <h2 id="wheel-title">${escapeHtml(state.title)}</h2>
      <div class="wheel-stage">
        <div class="wheel-pointer" aria-hidden="true"></div>
        <svg class="wheel" viewBox="-100 -100 200 200" role="img" aria-labelledby="wheel-title">
          <g class="wheel-rotor" id="wheel-rotor"></g>
          <circle r="7" class="wheel-hub"/>
        </svg>
      </div>
      <button type="button" class="btn primary wide" id="wheel-spin">Lancer la roue</button>
      <p class="wheel-result" id="wheel-result" aria-live="polite"></p>
      <label class="inline-option">
        <input type="checkbox" id="wheel-remove-winner" />
        Retirer le gagnant de la roue après chaque tirage
      </label>
    </section>

    <section class="card">
      <h2 id="wheel-entries-title"></h2>
      <ul class="chip-list" id="wheel-entries"></ul>
      <form id="wheel-add-form" class="row">
        <input id="wheel-add-input" type="text" placeholder="Ajouter une case" maxlength="${MAX_LABEL_LENGTH}" aria-label="Nouvelle case" />
        <button type="submit" class="btn">${icons.plus}<span>Ajouter</span></button>
      </form>
      <p class="error" id="wheel-add-error" hidden></p>
    </section>

    <section class="card">
      <h2>${icons.history} Tirages précédents</h2>
      <ol class="history-list" id="wheel-history"></ol>
    </section>
  `;

  const rotor = root.querySelector<SVGGElement>("#wheel-rotor")!;
  const spinButton = root.querySelector<HTMLButtonElement>("#wheel-spin")!;
  const result = root.querySelector<HTMLElement>("#wheel-result")!;
  const addForm = root.querySelector<HTMLFormElement>("#wheel-add-form")!;
  const addInput = root.querySelector<HTMLInputElement>("#wheel-add-input")!;
  const addError = root.querySelector<HTMLElement>("#wheel-add-error")!;

  function renderWheel(): void {
    rotor.innerHTML = wheelSvg(state.entries);
  }

  function renderEntries(): void {
    root.querySelector("#wheel-entries-title")!.textContent = `Cases (${state.entries.length})`;
    root.querySelector("#wheel-entries")!.innerHTML = state.entries
      .map(
        (entry, i) => `
        <li class="chip" style="--hue: ${segmentHue(i)}">
          <span>${escapeHtml(entry.label)}</span>
          <button type="button" class="chip-remove" data-id="${escapeHtml(entry.id)}" aria-label="Retirer ${escapeHtml(entry.label)}" ${spinning ? "disabled" : ""}>${icons.close}</button>
        </li>`,
      )
      .join("");
  }

  function renderHistory(): void {
    root.querySelector("#wheel-history")!.innerHTML = state.history.length
      ? state.history
          .map((draw) => `<li><strong>${escapeHtml(draw.winner)}</strong><span class="muted">${formatShortDate(draw.date)}</span></li>`)
          .join("")
      : `<li class="muted">Aucun tirage pour l'instant.</li>`;
  }

  function renderControls(): void {
    spinButton.disabled = spinning || state.entries.length < 2;
    spinButton.textContent = spinning ? "La roue tourne…" : "Lancer la roue";
  }

  function renderAll(): void {
    renderWheel();
    renderEntries();
    renderHistory();
    renderControls();
  }

  function finishSpin(winner: WheelEntry): void {
    spinning = false;
    state = recordDraw(state, winner, ctx.today, removeWinner);
    result.innerHTML = `${icons.checkCircle} <strong>${escapeHtml(winner.label)}</strong> est tiré${removeWinner ? " (retiré de la roue)" : ""} !`;
    // Si le gagnant est retiré, la roue est redessinée sans lui : on remet la
    // rotation à zéro (sans animation) plutôt que de laisser le pointeur sur
    // une case qui vient de changer de contenu.
    if (removeWinner) {
      rotation = 0;
      rotor.style.transition = "none";
      rotor.style.transform = "rotate(0deg)";
    }
    renderAll();
  }

  spinButton.addEventListener("click", () => {
    // Graine dérivée de celle du jeu de données et du numéro de tirage : une
    // même URL rejoue la même suite de tirages (démo reproductible, tests
    // e2e déterministes).
    const plan = planSpin(createRng(`${ctx.seed}:spin:${++spinCount}`), state.entries.length, rotation);
    const winner = state.entries[plan.winnerIndex];
    rotation = plan.rotation;
    spinning = true;
    result.textContent = "";
    const duration = prefersReducedMotion() ? 0 : SPIN_MS;
    rotor.style.transition = duration ? `transform ${duration}ms cubic-bezier(0.17, 0.67, 0.12, 1)` : "none";
    rotor.style.transform = `rotate(${rotation}deg)`;
    renderEntries();
    renderControls();
    spinTimer = setTimeout(() => finishSpin(winner), duration);
  });

  root.querySelector<HTMLInputElement>("#wheel-remove-winner")!.addEventListener("change", (e) => {
    removeWinner = (e.target as HTMLInputElement).checked;
  });

  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const next = addEntry(state, addInput.value, `e${nextEntryId}`);
    if (typeof next === "string") {
      addError.textContent = ENTRY_ERRORS[next];
      addError.hidden = false;
      return;
    }
    nextEntryId++;
    state = next;
    addInput.value = "";
    addError.hidden = true;
    renderAll();
  });

  root.querySelector("#wheel-entries")!.addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>(".chip-remove");
    if (!button) return;
    state = removeEntry(state, button.dataset.id!);
    renderAll();
  });

  renderAll();

  return () => clearTimeout(spinTimer);
}
