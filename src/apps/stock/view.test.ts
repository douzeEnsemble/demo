// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRng } from "../../lib/random";
import * as generator from "./generator";
import { mountStock } from "./view";

const ctx = { seed: "STOCK1", today: "2026-10-15" };

function fixture(): generator.StockState {
  return {
    shopName: "Épicerie <test>",
    products: [
      { id: "p1", sku: "EPI-1001", name: "Thé vert", category: "Boissons", unitPrice: 900, quantity: 0, threshold: 3, location: "Allée A · Étagère 1" },
      { id: "p2", sku: "EPI-1002", name: "Café grains", category: "Boissons", unitPrice: 1200, quantity: 2, threshold: 3, location: "Allée A · Étagère 2" },
      { id: "p3", sku: "EPI-1003", name: "Miel", category: "Sucré", unitPrice: 800, quantity: 20, threshold: 4, location: "Allée B · Étagère 1" },
    ],
    movements: [
      { id: "m2", productId: "p1", date: "2026-10-14", delta: -1, reason: "sale", quantityAfter: 0 },
      { id: "m1", productId: "p2", date: "2026-10-12", delta: 5, reason: "reception", quantityAfter: 2 },
    ],
  };
}

describe("mountStock", () => {
  let root: HTMLElement;
  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const names = () => Array.from(root.querySelectorAll(".product-name"), (el) => el.textContent);
  const action = (id: string, name: string) => q<HTMLButtonElement>(`[data-action=${name}][data-id=${id}]`);
  const kpi = (label: string) =>
    Array.from(root.querySelectorAll("#stock-kpis div")).find((d) => d.querySelector("dt")!.textContent === label)!;

  beforeEach(() => {
    vi.restoreAllMocks();
    root = document.createElement("div");
    document.body.replaceChildren(root);
  });

  it("affiche l'inventaire généré pour la graine", () => {
    const state = generator.generateStock(createRng(ctx.seed), ctx.today);
    mountStock(root, ctx);
    expect(root.querySelector("h2")!.textContent).toBe(state.shopName);
    expect(root.querySelectorAll(".product")).toHaveLength(state.products.length);
    expect(root.querySelectorAll("#stock-movements li")).toHaveLength(12);
    expect(root.querySelectorAll("#stock-category option")).toHaveLength(generator.categories(state).length + 1);
  });

  it("affiche indicateurs, états et boutons de réappro des seuls produits en alerte", () => {
    vi.spyOn(generator, "generateStock").mockReturnValue(fixture());
    mountStock(root, ctx);
    expect(root.querySelector("h2")!.innerHTML).toBe("Épicerie &lt;test&gt;");
    expect(kpi("Références").textContent).toContain("3");
    expect(kpi("Stocks bas").className).toBe("kpi-warning");
    expect(kpi("Ruptures").className).toBe("kpi-danger");
    expect(names()).toEqual(["Café grains", "Miel", "Thé vert"]);
    expect(q('.product[data-id="p1"]').className).toContain("status-out");
    expect(q('.product[data-id="p2"]').className).toContain("status-low");
    expect(action("p1", "sale").disabled).toBe(true);
    expect(action("p2", "restock").textContent).toBe("Réappro. +7");
    expect(root.querySelector('[data-action=restock][data-id="p3"]')).toBeNull();
  });

  it("enregistre entrées, sorties et réappros, et met tout à jour", () => {
    vi.spyOn(generator, "generateStock").mockReturnValue(fixture());
    mountStock(root, ctx);
    action("p3", "sale").click();
    expect(q('.product[data-id="p3"] .stock-badge strong').textContent).toBe("19");
    expect(q("#stock-movements li").textContent).toContain("Miel · Vente");
    action("p1", "reception").click();
    expect(q("#stock-movements li").textContent).toContain("+1");
    action("p2", "restock").click();
    expect(q('.product[data-id="p2"] .stock-badge strong').textContent).toBe("9");
    expect(q('.product[data-id="p2"]').className).toContain("status-ok");
    expect(kpi("Stocks bas").className).toBe("kpi-warning");
    expect(kpi("Ruptures").className).toBe("");
    action("p1", "restock").click();
    expect(kpi("Stocks bas").className).toBe("");
  });

  it("n'enregistre rien quand le mouvement est refusé", () => {
    vi.spyOn(generator, "generateStock").mockReturnValue(fixture());
    mountStock(root, ctx);
    // Bouton normalement désactivé (stock nul) : on force le clic.
    action("p1", "sale").disabled = false;
    action("p1", "sale").click();
    expect(root.querySelectorAll("#stock-movements li")).toHaveLength(2);
  });

  it("ignore un clic hors bouton dans la liste", () => {
    vi.spyOn(generator, "generateStock").mockReturnValue(fixture());
    mountStock(root, ctx);
    q('.product[data-id="p3"]').click();
    expect(root.querySelectorAll("#stock-movements li")).toHaveLength(2);
  });

  it("filtre l'historique sur un produit puis revient à tout afficher", () => {
    vi.spyOn(generator, "generateStock").mockReturnValue(fixture());
    mountStock(root, ctx);
    action("p1", "history").click();
    expect(q("#stock-movements-title").textContent).toBe("Mouvements — Thé vert");
    expect(q('.product[data-id="p1"]').className).toContain("selected");
    expect(root.querySelectorAll("#stock-movements li")).toHaveLength(1);
    expect(q("#stock-movements li").textContent).not.toContain("Thé vert ·");
    expect(q("#stock-movements-all").hidden).toBe(false);

    action("p3", "history").click();
    expect(q("#stock-movements").textContent).toContain("Aucun mouvement sur la période.");
    action("p3", "history").click();
    expect(q("#stock-movements-title").textContent).toBe("Derniers mouvements");

    action("p1", "history").click();
    q<HTMLButtonElement>("#stock-movements-all").click();
    expect(q("#stock-movements-title").textContent).toBe("Derniers mouvements");
    expect(q("#stock-movements-all").hidden).toBe(true);
  });

  it("filtre par recherche, catégorie et état", () => {
    vi.spyOn(generator, "generateStock").mockReturnValue(fixture());
    mountStock(root, ctx);
    const search = q<HTMLInputElement>("#stock-search");
    search.value = "the";
    search.dispatchEvent(new Event("input"));
    expect(names()).toEqual(["Thé vert"]);
    search.value = "introuvable";
    search.dispatchEvent(new Event("input"));
    expect(q("#stock-products").textContent).toContain("Aucun produit ne correspond");
    search.value = "";
    search.dispatchEvent(new Event("input"));

    const category = q<HTMLSelectElement>("#stock-category");
    category.value = "Sucré";
    category.dispatchEvent(new Event("change"));
    expect(names()).toEqual(["Miel"]);
    category.value = "";
    category.dispatchEvent(new Event("change"));

    const status = q<HTMLSelectElement>("#stock-status");
    status.value = "alert";
    status.dispatchEvent(new Event("change"));
    expect(names()).toEqual(["Café grains", "Thé vert"]);
    status.value = "out";
    status.dispatchEvent(new Event("change"));
    expect(names()).toEqual(["Thé vert"]);
  });

  it("renvoie un nettoyage sans effet", () => {
    expect(mountStock(root, ctx)()).toBeUndefined();
  });
});
