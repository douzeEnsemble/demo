import type { DemoContext } from "../../apps";
import { escapeHtml } from "../../lib/dom";
import { formatMoney, formatNumber, formatShortDate } from "../../lib/format";
import { icons } from "../../lib/icons";
import { createRng } from "../../lib/random";
import {
  applyMovement,
  categories,
  filterProducts,
  generateStock,
  inventorySummary,
  REASON_LABELS,
  restockQuantity,
  stockStatus,
  type MovementReason,
  type Product,
  type ProductFilter,
  type StockState,
} from "./generator";

const STATUS_LABELS = { ok: "En stock", low: "Stock bas", out: "Rupture" } as const;
const RECENT_MOVEMENTS = 12;

export function mountStock(root: HTMLElement, ctx: DemoContext): () => void {
  let state: StockState = generateStock(createRng(ctx.seed), ctx.today);
  const filter: ProductFilter = { query: "", category: "", status: "" };
  let selectedProductId: string | null = null;
  let nextMovementId = state.movements.length + 1;

  root.innerHTML = `
    <section class="card">
      <h2>${escapeHtml(state.shopName)}</h2>
      <dl class="kpis" id="stock-kpis"></dl>
    </section>

    <section class="card">
      <div class="filters">
        <label class="search-field">
          ${icons.search}
          <input id="stock-search" type="search" placeholder="Rechercher un produit ou une référence" aria-label="Rechercher" />
        </label>
        <select id="stock-category" aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          ${categories(state)
            .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
            .join("")}
        </select>
        <select id="stock-status" aria-label="État du stock">
          <option value="">Tous les états</option>
          <option value="alert">Alertes (bas + rupture)</option>
          <option value="out">Ruptures</option>
        </select>
      </div>
      <ul class="product-list" id="stock-products"></ul>
    </section>

    <section class="card">
      <div class="card-heading">
        <h2 id="stock-movements-title"></h2>
        <button type="button" class="btn small" id="stock-movements-all" hidden>Tout afficher</button>
      </div>
      <ol class="history-list" id="stock-movements"></ol>
    </section>
  `;

  const productName = (id: string): string => state.products.find((p) => p.id === id)!.name;

  function renderKpis(): void {
    const s = inventorySummary(state);
    root.querySelector("#stock-kpis")!.innerHTML = `
      <div><dt>Références</dt><dd>${formatNumber(s.references)}</dd></div>
      <div><dt>Unités en stock</dt><dd>${formatNumber(s.units)}</dd></div>
      <div><dt>Valeur du stock</dt><dd>${formatMoney(s.value)}</dd></div>
      <div class="${s.low ? "kpi-warning" : ""}"><dt>Stocks bas</dt><dd>${formatNumber(s.low)}</dd></div>
      <div class="${s.out ? "kpi-danger" : ""}"><dt>Ruptures</dt><dd>${formatNumber(s.out)}</dd></div>
    `;
  }

  function productHtml(p: Product): string {
    const status = stockStatus(p);
    const id = escapeHtml(p.id);
    return `
      <li class="product status-${status}${p.id === selectedProductId ? " selected" : ""}" data-id="${id}">
        <div class="product-main">
          <button type="button" class="product-name link-btn" data-action="history" data-id="${id}" aria-label="Historique de ${escapeHtml(p.name)}">${escapeHtml(p.name)}</button>
          <span class="muted product-meta">${escapeHtml(p.sku)} · ${escapeHtml(p.category)} · ${escapeHtml(p.location)} · ${formatMoney(p.unitPrice)}</span>
        </div>
        <div class="product-stock">
          <span class="stock-badge" title="Seuil d'alerte : ${p.threshold}">
            ${status === "ok" ? "" : icons.alert}<strong>${formatNumber(p.quantity)}</strong>
            <span class="visually-hidden">${STATUS_LABELS[status]}</span>
          </span>
          <button type="button" class="icon-btn" data-action="sale" data-id="${id}" aria-label="Sortie d'une unité de ${escapeHtml(p.name)}" ${p.quantity === 0 ? "disabled" : ""}>${icons.minus}</button>
          <button type="button" class="icon-btn" data-action="reception" data-id="${id}" aria-label="Entrée d'une unité de ${escapeHtml(p.name)}">${icons.plus}</button>
          ${status === "ok" ? "" : `<button type="button" class="btn small" data-action="restock" data-id="${id}">Réappro. +${restockQuantity(p)}</button>`}
        </div>
      </li>`;
  }

  function renderProducts(): void {
    const products = filterProducts(state.products, filter);
    root.querySelector("#stock-products")!.innerHTML = products.length
      ? products.map(productHtml).join("")
      : `<li class="empty-state">Aucun produit ne correspond à ces filtres.</li>`;
  }

  function renderMovements(): void {
    const selected = selectedProductId;
    const movements = (selected ? state.movements.filter((m) => m.productId === selected) : state.movements).slice(0, RECENT_MOVEMENTS);
    root.querySelector("#stock-movements-title")!.textContent = selected ? `Mouvements — ${productName(selected)}` : "Derniers mouvements";
    root.querySelector<HTMLElement>("#stock-movements-all")!.hidden = !selected;
    root.querySelector("#stock-movements")!.innerHTML = movements.length
      ? movements
          .map(
            (m) => `
          <li class="movement ${m.delta > 0 ? "in" : "out"}">
            <span>
              <strong class="movement-delta">${m.delta > 0 ? "+" : "−"}${formatNumber(Math.abs(m.delta))}</strong>
              ${selected ? "" : `${escapeHtml(productName(m.productId))} · `}${REASON_LABELS[m.reason]}
            </span>
            <span class="muted">${formatShortDate(m.date)} · reste ${formatNumber(m.quantityAfter)}</span>
          </li>`,
          )
          .join("")
      : `<li class="muted">Aucun mouvement sur la période.</li>`;
  }

  function renderAll(): void {
    renderKpis();
    renderProducts();
    renderMovements();
  }

  function move(productId: string, delta: number, reason: MovementReason): void {
    const next = applyMovement(state, productId, delta, reason, ctx.today, `m${nextMovementId}`);
    // Les seuls refus possibles (stock négatif, delta nul) correspondent à
    // des boutons déjà désactivés ou absents : rien à signaler de plus.
    if (typeof next === "string") return;
    nextMovementId++;
    state = next;
    renderAll();
  }

  root.querySelector("#stock-products")!.addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button) return;
    const id = button.dataset.id!;
    switch (button.dataset.action) {
      case "sale":
        move(id, -1, "sale");
        break;
      case "reception":
        move(id, 1, "reception");
        break;
      case "restock":
        move(id, restockQuantity(state.products.find((p) => p.id === id)!), "reception");
        break;
      default:
        selectedProductId = selectedProductId === id ? null : id;
        renderProducts();
        renderMovements();
    }
  });

  root.querySelector("#stock-movements-all")!.addEventListener("click", () => {
    selectedProductId = null;
    renderProducts();
    renderMovements();
  });

  root.querySelector<HTMLInputElement>("#stock-search")!.addEventListener("input", (e) => {
    filter.query = (e.target as HTMLInputElement).value;
    renderProducts();
  });
  root.querySelector<HTMLSelectElement>("#stock-category")!.addEventListener("change", (e) => {
    filter.category = (e.target as HTMLSelectElement).value;
    renderProducts();
  });
  root.querySelector<HTMLSelectElement>("#stock-status")!.addEventListener("change", (e) => {
    filter.status = (e.target as HTMLSelectElement).value as ProductFilter["status"];
    renderProducts();
  });

  renderAll();
  return () => {};
}
