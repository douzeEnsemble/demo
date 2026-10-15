import { describe, expect, it } from "vitest";
import { createRng } from "../../lib/random";
import {
  applyMovement,
  categories,
  filterProducts,
  generateStock,
  inventorySummary,
  restockQuantity,
  stockStatus,
  type Product,
  type StockState,
} from "./generator";

const TODAY = "2026-10-15";
const SEEDS = Array.from({ length: 30 }, (_, i) => `S${i}`);

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    sku: "EPI-1001",
    name: "Miel de lavande",
    category: "Sucré",
    unitPrice: 900,
    quantity: 10,
    threshold: 4,
    location: "Allée A · Étagère 1",
    ...overrides,
  };
}

function stock(products: Product[]): StockState {
  return { shopName: "Boutique", products, movements: [] };
}

describe("generateStock", () => {
  it("est déterministe pour une graine donnée", () => {
    expect(generateStock(createRng("A"), TODAY)).toEqual(generateStock(createRng("A"), TODAY));
  });

  it("produit des références uniques au catalogue d'une seule boutique", () => {
    for (const seed of SEEDS) {
      const s = generateStock(createRng(seed), TODAY);
      expect(s.products.length).toBeGreaterThanOrEqual(14);
      expect(new Set(s.products.map((p) => p.id)).size).toBe(s.products.length);
      expect(new Set(s.products.map((p) => p.sku)).size).toBe(s.products.length);
      expect(new Set(s.products.map((p) => p.name)).size).toBe(s.products.length);
      expect(new Set(s.products.map((p) => p.sku.slice(0, 3))).size).toBe(1);
      for (const p of s.products) {
        expect(p.unitPrice % 10).toBe(0);
        expect(p.unitPrice).toBeGreaterThan(0);
        expect(p.threshold).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("garde un historique cohérent : chaque mouvement découle du précédent, jamais négatif, et aboutit au stock affiché", () => {
    for (const seed of SEEDS) {
      const s = generateStock(createRng(seed), TODAY);
      for (const p of s.products) {
        // Les mouvements sont du plus récent au plus ancien.
        const history = s.movements.filter((m) => m.productId === p.id).reverse();
        expect(history.length).toBeGreaterThan(0);
        expect(history[history.length - 1].quantityAfter).toBe(p.quantity);
        let before = history[0].quantityAfter - history[0].delta;
        expect(before).toBeGreaterThan(p.threshold);
        for (const m of history) {
          expect(m.quantityAfter).toBe(before + m.delta);
          expect(m.quantityAfter).toBeGreaterThanOrEqual(0);
          expect(m.delta).not.toBe(0);
          expect(m.date <= TODAY).toBe(true);
          if (m.reason === "reception") expect(m.delta).toBeGreaterThan(0);
          else expect(m.delta).toBeLessThan(0);
          before = m.quantityAfter;
        }
      }
      s.movements.forEach((m, i) => {
        if (i > 0) expect(m.date <= s.movements[i - 1].date).toBe(true);
      });
      expect(new Set(s.movements.map((m) => m.id)).size).toBe(s.movements.length);
    }
  });

  it("présente presque toujours des alertes (stocks bas ou ruptures) à traiter", () => {
    const withAlerts = SEEDS.filter((seed) => {
      const summary = inventorySummary(generateStock(createRng(seed), TODAY));
      return summary.low + summary.out > 0;
    });
    expect(withAlerts.length).toBeGreaterThanOrEqual(SEEDS.length - 2);
  });

  it("varie les boutiques selon la graine", () => {
    expect(new Set(SEEDS.map((seed) => generateStock(createRng(seed), TODAY).shopName)).size).toBeGreaterThan(3);
  });
});

describe("stockStatus / restockQuantity", () => {
  it("classe en rupture, bas (seuil inclus) ou sain", () => {
    expect(stockStatus(product({ quantity: 0 }))).toBe("out");
    expect(stockStatus(product({ quantity: 1 }))).toBe("low");
    expect(stockStatus(product({ quantity: 4 }))).toBe("low");
    expect(stockStatus(product({ quantity: 5 }))).toBe("ok");
  });

  it("propose de revenir à 3 fois le seuil, jamais une quantité négative", () => {
    expect(restockQuantity(product({ quantity: 1 }))).toBe(11);
    expect(restockQuantity(product({ quantity: 12 }))).toBe(0);
    expect(restockQuantity(product({ quantity: 20 }))).toBe(0);
  });
});

describe("applyMovement", () => {
  it("met à jour la quantité et journalise le mouvement en tête", () => {
    const s = stock([product(), product({ id: "p2", quantity: 3 })]);
    const next = applyMovement(s, "p1", -2, "sale", TODAY, "m9");
    expect(next).toEqual({
      ...s,
      products: [product({ quantity: 8 }), product({ id: "p2", quantity: 3 })],
      movements: [{ id: "m9", productId: "p1", date: TODAY, delta: -2, reason: "sale", quantityAfter: 8 }],
    });
  });

  it("autorise de vider exactement le stock", () => {
    const next = applyMovement(stock([product()]), "p1", -10, "loss", TODAY, "m1");
    expect(typeof next !== "string" && next.products[0].quantity).toBe(0);
  });

  it("refuse un produit inconnu, un mouvement nul ou un stock négatif", () => {
    const s = stock([product()]);
    expect(applyMovement(s, "zz", 1, "reception", TODAY, "m1")).toBe("unknownProduct");
    expect(applyMovement(s, "p1", 0, "adjustment", TODAY, "m1")).toBe("zero");
    expect(applyMovement(s, "p1", -11, "sale", TODAY, "m1")).toBe("negativeStock");
  });
});

describe("inventorySummary / categories", () => {
  it("additionne unités et valeur, compte les alertes", () => {
    const s = stock([product({ quantity: 10, unitPrice: 250 }), product({ id: "p2", quantity: 2 }), product({ id: "p3", quantity: 0 })]);
    expect(inventorySummary(s)).toEqual({ references: 3, units: 12, value: 10 * 250 + 2 * 900, low: 1, out: 1 });
  });

  it("liste les catégories une seule fois, triées", () => {
    const s = stock([product({ category: "Épices" }), product({ category: "Boissons" }), product({ category: "Épices" }), product({ category: "Sucré" })]);
    expect(categories(s)).toEqual(["Boissons", "Épices", "Sucré"]);
  });
});

describe("filterProducts", () => {
  const products = [
    product({ id: "p1", name: "Thé vert", sku: "EPI-1001", category: "Boissons", quantity: 0 }),
    product({ id: "p2", name: "Café grains", sku: "EPI-1002", category: "Boissons", quantity: 3 }),
    product({ id: "p3", name: "Miel", sku: "EPI-1003", category: "Sucré", quantity: 20 }),
  ];
  const all = { query: "", category: "", status: "" } as const;

  it("trie par nom sans filtre", () => {
    expect(filterProducts(products, all).map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
  });

  it("cherche dans le nom et la référence, sans accents ni casse", () => {
    expect(filterProducts(products, { ...all, query: "CAFE" }).map((p) => p.id)).toEqual(["p2"]);
    expect(filterProducts(products, { ...all, query: "1003" }).map((p) => p.id)).toEqual(["p3"]);
    expect(filterProducts(products, { ...all, query: "   " })).toHaveLength(3);
  });

  it("filtre par catégorie et par état", () => {
    expect(filterProducts(products, { ...all, category: "Boissons" }).map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(filterProducts(products, { ...all, status: "alert" }).map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(filterProducts(products, { ...all, status: "out" }).map((p) => p.id)).toEqual(["p1"]);
  });
});
