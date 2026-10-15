import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatLongDate,
  formatMoney,
  formatNumber,
  formatShortDate,
  normalizeForSearch,
  parseIsoDate,
  plural,
  toIsoDate,
} from "./format";

// Intl insère des espaces insécables (fines ou non) : on les normalise pour
// garder des attentes lisibles.
const spaces = (s: string) => s.replace(/[  ]/g, " ");

describe("dates ISO", () => {
  it("toIsoDate formate la date locale sur deux chiffres", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("parseIsoDate est l'inverse de toIsoDate", () => {
    const d = parseIsoDate("2026-10-15");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 15]);
    expect(toIsoDate(d)).toBe("2026-10-15");
  });

  it("addDays traverse les fins de mois et d'année", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("daysBetween compte les jours (signé), changement d'heure compris", () => {
    expect(daysBetween("2026-10-15", "2026-10-25")).toBe(10);
    expect(daysBetween("2026-10-25", "2026-10-15")).toBe(-10);
    expect(daysBetween("2026-03-20", "2026-04-05")).toBe(16);
  });

  it("formate les dates en français", () => {
    expect(formatShortDate("2026-10-15")).toBe("jeu. 15 oct.");
    expect(formatLongDate("2026-10-15")).toBe("jeudi 15 octobre 2026");
  });
});

describe("nombres", () => {
  it("formatMoney convertit des centimes en euros", () => {
    expect(spaces(formatMoney(123456))).toBe("1 234,56 €");
    expect(spaces(formatMoney(50))).toBe("0,50 €");
  });

  it("formatNumber sépare les milliers", () => {
    expect(spaces(formatNumber(12500))).toBe("12 500");
  });

  it("plural accorde à partir de 2", () => {
    expect(plural(0, "place")).toBe("0 place");
    expect(plural(1, "place")).toBe("1 place");
    expect(plural(2, "place")).toBe("2 places");
    expect(plural(-3, "place")).toBe("-3 places");
    expect(plural(3, "voix", "voix")).toBe("3 voix");
  });
});

describe("normalizeForSearch", () => {
  it("ignore accents, casse et espaces autour", () => {
    expect(normalizeForSearch("  Café Crème ")).toBe("cafe creme");
  });
});
