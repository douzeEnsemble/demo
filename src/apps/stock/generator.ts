import { addDays, normalizeForSearch } from "../../lib/format";
import type { Rng } from "../../lib/random";

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: number; // centimes
  quantity: number;
  /** Seuil d'alerte : à ce niveau ou en dessous, le stock est « bas ». */
  threshold: number;
  location: string;
}

export type MovementReason = "reception" | "sale" | "loss" | "adjustment";

export interface Movement {
  id: string;
  productId: string;
  date: string;
  delta: number;
  reason: MovementReason;
  /** Quantité en stock juste après ce mouvement. */
  quantityAfter: number;
}

export interface StockState {
  shopName: string;
  products: Product[];
  /** Du plus récent au plus ancien. */
  movements: Movement[];
}

// Stryker disable StringLiteral,ArrayDeclaration,ObjectLiteral: réservoir de données
// fictives — aucun test n'a de raison d'en vérifier le texte exact, seulement
// la forme des données produites (voir generator.test.ts).
export const REASON_LABELS: Record<MovementReason, string> = {
  reception: "Réception",
  sale: "Vente",
  loss: "Casse / perte",
  adjustment: "Ajustement d'inventaire",
};
// Stryker restore all

/** [nom, catégorie, prix minimum, prix maximum] en centimes. */
type CatalogItem = readonly [string, string, number, number];

interface Catalog {
  shopNames: readonly string[];
  skuPrefix: string;
  items: readonly CatalogItem[];
}

// Stryker disable StringLiteral,ArrayDeclaration,ObjectLiteral: réservoir de données
// fictives — aucun test n'a de raison d'en vérifier le texte exact, seulement
// la forme des données produites (voir generator.test.ts).
const CATALOGS: readonly Catalog[] = [
  {
    shopNames: ["Épicerie fine Le Panier", "La Belle Épicerie", "Comptoir des Saveurs"],
    skuPrefix: "EPI",
    items: [
      ["Huile d'olive vierge extra 50 cl", "Huiles & vinaigres", 900, 1600],
      ["Vinaigre balsamique 25 cl", "Huiles & vinaigres", 600, 1200],
      ["Huile de noix 25 cl", "Huiles & vinaigres", 700, 1100],
      ["Miel de lavande 250 g", "Sucré", 750, 1100],
      ["Confiture de figues 340 g", "Sucré", 450, 650],
      ["Pâte à tartiner noisette 350 g", "Sucré", 650, 900],
      ["Caramel au beurre salé 220 g", "Sucré", 550, 800],
      ["Biscuits sablés pur beurre", "Sucré", 400, 650],
      ["Thé vert jasmin 100 g", "Boissons", 800, 1300],
      ["Café grains Éthiopie 250 g", "Boissons", 900, 1400],
      ["Jus de pomme artisanal 1 L", "Boissons", 350, 550],
      ["Sirop de menthe 50 cl", "Boissons", 450, 700],
      ["Rillettes de canard 180 g", "Salé", 600, 900],
      ["Tapenade noire 100 g", "Salé", 400, 600],
      ["Sardines millésimées", "Salé", 550, 950],
      ["Fleur de sel de Guérande 125 g", "Salé", 450, 700],
      ["Pâtes artisanales 500 g", "Épicerie", 350, 600],
      ["Riz de Camargue 1 kg", "Épicerie", 400, 650],
      ["Lentilles vertes du Puy 500 g", "Épicerie", 350, 550],
      ["Moutarde à l'ancienne 210 g", "Épicerie", 300, 500],
      ["Poivre de Kampot 50 g", "Épices", 900, 1500],
      ["Herbes de Provence 40 g", "Épices", 300, 500],
      ["Curry de Madras 50 g", "Épices", 400, 650],
      ["Safran en filaments 0,5 g", "Épices", 1200, 1900],
    ],
  },
  {
    shopNames: ["Papeterie du Centre", "Bureau Malin", "L'Atelier Fournitures"],
    skuPrefix: "BUR",
    items: [
      ["Ramette papier A4 80 g", "Papier", 450, 700],
      ["Bloc-notes A5 ligné", "Papier", 250, 450],
      ["Cahier spirale 100 pages", "Papier", 300, 550],
      ["Enveloppes C5 (lot de 50)", "Papier", 600, 950],
      ["Post-it 76 × 76 (lot de 6)", "Papier", 650, 1000],
      ["Stylo bille bleu", "Écriture", 80, 150],
      ["Stylo gel noir", "Écriture", 150, 250],
      ["Surligneurs (lot de 4)", "Écriture", 350, 600],
      ["Crayon à papier HB", "Écriture", 50, 120],
      ["Feutres effaçables (lot de 4)", "Écriture", 500, 800],
      ["Agrafeuse de bureau", "Petit matériel", 900, 1600],
      ["Agrafes 24/6 (boîte de 1000)", "Petit matériel", 150, 300],
      ["Perforatrice 2 trous", "Petit matériel", 800, 1400],
      ["Ciseaux 21 cm", "Petit matériel", 300, 600],
      ["Ruban adhésif (lot de 8)", "Petit matériel", 400, 700],
      ["Classeur à levier A4", "Classement", 300, 550],
      ["Pochettes perforées (lot de 100)", "Classement", 450, 750],
      ["Intercalaires 12 positions", "Classement", 200, 400],
      ["Boîte d'archives", "Classement", 250, 450],
      ["Cartouche d'encre noire", "Impression", 1500, 2900],
      ["Cartouche d'encre couleur", "Impression", 1800, 3400],
      ["Toner laser", "Impression", 4500, 8900],
      ["Clé USB 32 Go", "Informatique", 700, 1300],
      ["Souris sans fil", "Informatique", 1200, 2500],
    ],
  },
  {
    shopNames: ["Le Jardin de Mathis", "Graines & Racines", "Jardinerie des Quatre Saisons"],
    skuPrefix: "JAR",
    items: [
      ["Terreau universel 40 L", "Terreaux & engrais", 700, 1200],
      ["Engrais tomates 1 kg", "Terreaux & engrais", 600, 950],
      ["Paillage de lin 50 L", "Terreaux & engrais", 1100, 1700],
      ["Billes d'argile 10 L", "Terreaux & engrais", 500, 850],
      ["Graines de tomates cerises", "Graines", 200, 350],
      ["Graines de basilic", "Graines", 150, 300],
      ["Graines de radis", "Graines", 150, 280],
      ["Mélange fleurs mellifères", "Graines", 300, 550],
      ["Gazon rustique 1 kg", "Graines", 900, 1500],
      ["Bulbes de tulipes (×20)", "Bulbes", 600, 1100],
      ["Bulbes de dahlias (×5)", "Bulbes", 700, 1200],
      ["Sécateur de précision", "Outils", 1500, 2900],
      ["Transplantoir inox", "Outils", 600, 1100],
      ["Gants de jardinage", "Outils", 500, 900],
      ["Arrosoir 10 L", "Outils", 900, 1600],
      ["Râteau à feuilles", "Outils", 1200, 2000],
      ["Pot terre cuite Ø 20 cm", "Pots & jardinières", 500, 900],
      ["Jardinière 60 cm", "Pots & jardinières", 900, 1500],
      ["Soucoupe Ø 20 cm", "Pots & jardinières", 200, 400],
      ["Tuteurs bambou (lot de 10)", "Accessoires", 400, 700],
      ["Ficelle de jardin 100 m", "Accessoires", 300, 550],
      ["Étiquettes de semis (×50)", "Accessoires", 250, 450],
      ["Nichoir à mésanges", "Accessoires", 1500, 2500],
    ],
  },
];

const AISLES = ["A", "B", "C", "D"] as const;
// Stryker restore all
const HISTORY_DAYS = 30;
const LATE_SUPPLIER_DAYS = 14;

export function stockStatus(product: Product): "out" | "low" | "ok" {
  if (product.quantity === 0) return "out";
  return product.quantity <= product.threshold ? "low" : "ok";
}

/** Quantité à commander pour revenir à un stock confortable (3 × le seuil). */
export function restockQuantity(product: Product): number {
  return Math.max(product.threshold * 3 - product.quantity, 0);
}

/**
 * Le stock final n'est pas tiré au hasard : il résulte d'une simulation
 * jour par jour des 30 derniers jours (ventes, réceptions quand le seuil est
 * atteint, casse occasionnelle) à partir d'un stock initial. L'historique
 * des mouvements est donc toujours cohérent avec les quantités affichées
 * (chaque `quantityAfter` découle du précédent, jamais négatif), et la
 * répartition entre stocks sains, bas et en rupture émerge d'elle-même.
 */
export function generateStock(rng: Rng, today: string): StockState {
  const catalog = rng.pick(CATALOGS);
  const picked = rng.sample(catalog.items, rng.int(14, 20));
  const movements: Movement[] = [];
  let movementId = 0;

  const products: Product[] = picked.map(([name, category, minPrice, maxPrice], i) => {
    // Prix arrondi aux 10 centimes, comme sur une étiquette.
    const unitPrice = Math.round(rng.int(minPrice, maxPrice) / 10) * 10;
    // Les petits articles bon marché se vendent et se stockent en plus
    // grande quantité que les gros articles chers.
    const scale = unitPrice < 500 ? 3 : unitPrice < 1500 ? 2 : 1;
    const threshold = rng.int(2, 5) * scale;
    return {
      id: `p${i + 1}`,
      sku: `${catalog.skuPrefix}-${rng.int(1, 9)}${String(i + 1).padStart(3, "0")}`,
      name,
      category,
      unitPrice,
      quantity: rng.int(threshold + 1, threshold * 4),
      threshold,
      location: `Allée ${rng.pick(AISLES)} · Étagère ${rng.int(1, 6)}`,
    };
  });

  const record = (product: Product, date: string, delta: number, reason: MovementReason): void => {
    product.quantity += delta;
    movements.push({ id: `m${++movementId}`, productId: product.id, date, delta, reason, quantityAfter: product.quantity });
  };

  // Certains fournisseurs livrent avec retard : leurs produits ne sont plus
  // réapprovisionnés sur les deux dernières semaines, ce qui produit
  // naturellement des stocks bas ou en rupture.
  const lateSupplier = new Set(rng.sample(products, rng.int(3, 5)).map((p) => p.id));

  for (let day = HISTORY_DAYS; day >= 0; day--) {
    const date = addDays(today, -day);
    for (const product of products) {
      const demand = rng.chance(0.55) ? rng.int(1, Math.max(1, Math.round(product.threshold / 2))) : 0;
      const sold = Math.min(demand, product.quantity);
      if (sold > 0) record(product, date, -sold, "sale");
      if (product.quantity > 0 && rng.chance(0.015)) record(product, date, -1, "loss");
      const blocked = lateSupplier.has(product.id) && day <= LATE_SUPPLIER_DAYS;
      if (!blocked && day > 0 && product.quantity <= product.threshold && rng.chance(0.5)) {
        record(product, date, restockQuantity(product) + rng.int(0, product.threshold), "reception");
      }
    }
  }

  return {
    shopName: rng.pick(catalog.shopNames),
    products,
    movements: movements.reverse(),
  };
}

export type MovementError = "unknownProduct" | "zero" | "negativeStock";

export function applyMovement(
  state: StockState,
  productId: string,
  delta: number,
  reason: MovementReason,
  date: string,
  id: string,
): StockState | MovementError {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return "unknownProduct";
  if (delta === 0) return "zero";
  const quantity = product.quantity + delta;
  if (quantity < 0) return "negativeStock";
  return {
    ...state,
    products: state.products.map((p) => (p.id === productId ? { ...p, quantity } : p)),
    movements: [{ id, productId, date, delta, reason, quantityAfter: quantity }, ...state.movements],
  };
}

export interface InventorySummary {
  references: number;
  units: number;
  value: number; // centimes
  low: number;
  out: number;
}

export function inventorySummary(state: StockState): InventorySummary {
  const summary: InventorySummary = { references: state.products.length, units: 0, value: 0, low: 0, out: 0 };
  for (const p of state.products) {
    summary.units += p.quantity;
    summary.value += p.quantity * p.unitPrice;
    const status = stockStatus(p);
    if (status !== "ok") summary[status]++;
  }
  return summary;
}

export function categories(state: StockState): string[] {
  return [...new Set(state.products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, "fr"));
}

export interface ProductFilter {
  query: string;
  category: string; // "" = toutes
  status: "" | "alert" | "out";
}

/** Recherche sur le nom et la référence, insensible à la casse et aux
 * accents ; « alert » regroupe stocks bas et ruptures. Tri par nom. */
export function filterProducts(products: readonly Product[], filter: ProductFilter): Product[] {
  const query = normalizeForSearch(filter.query);
  return products
    .filter((p) => !query || normalizeForSearch(`${p.name} ${p.sku}`).includes(query))
    .filter((p) => !filter.category || p.category === filter.category)
    .filter((p) => {
      if (filter.status === "out") return stockStatus(p) === "out";
      if (filter.status === "alert") return stockStatus(p) !== "ok";
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
