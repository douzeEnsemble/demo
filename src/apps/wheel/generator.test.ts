import { describe, expect, it } from "vitest";
import { createRng } from "../../lib/random";
import { addDays, daysBetween } from "../../lib/format";
import {
  addEntry,
  generateWheel,
  MAX_ENTRIES,
  MAX_HISTORY,
  MAX_LABEL_LENGTH,
  MAX_TURNS,
  MIN_TURNS,
  planSpin,
  recordDraw,
  removeEntry,
  segmentAt,
  segmentHue,
  type WheelState,
} from "./generator";

const TODAY = "2026-10-15";
const SEEDS = Array.from({ length: 40 }, (_, i) => `W${i}`);

function state(labels: string[]): WheelState {
  return { title: "T", entries: labels.map((label, i) => ({ id: `e${i + 1}`, label })), history: [] };
}

describe("generateWheel", () => {
  it("est déterministe pour une graine donnée", () => {
    expect(generateWheel(createRng("A"), TODAY)).toEqual(generateWheel(createRng("A"), TODAY));
  });

  it("produit des cases distinctes, en nombre jouable, aux ids uniques", () => {
    for (const seed of SEEDS) {
      const wheel = generateWheel(createRng(seed), TODAY);
      expect(wheel.entries.length).toBeGreaterThanOrEqual(3);
      expect(wheel.entries.length).toBeLessThanOrEqual(12);
      expect(new Set(wheel.entries.map((e) => e.label)).size).toBe(wheel.entries.length);
      expect(new Set(wheel.entries.map((e) => e.id)).size).toBe(wheel.entries.length);
    }
  });

  it("a un historique passé, à intervalle régulier, dont chaque gagnant est sur la roue", () => {
    for (const seed of SEEDS) {
      const wheel = generateWheel(createRng(seed), TODAY);
      expect(wheel.history.length).toBeGreaterThanOrEqual(2);
      const labels = wheel.entries.map((e) => e.label);
      const step = daysBetween(wheel.history[0].date, TODAY);
      expect(step).toBeGreaterThan(0);
      wheel.history.forEach((draw, i) => {
        expect(labels).toContain(draw.winner);
        expect(draw.date).toBe(addDays(TODAY, -step * (i + 1)));
      });
    }
  });

  it("varie les scénarios selon la graine (personnes et listes fixes)", () => {
    const titles = new Set(SEEDS.map((s) => generateWheel(createRng(s), TODAY).title));
    expect(titles.size).toBeGreaterThanOrEqual(4);
  });
});

describe("segmentAt", () => {
  it("rotation nulle : le pointeur est au début du segment 0", () => {
    expect(segmentAt(0, 4)).toBe(0);
  });

  it("la roue tourne dans le sens horaire : le segment précédent arrive sous le pointeur", () => {
    expect(segmentAt(10, 4)).toBe(3);
    expect(segmentAt(100, 4)).toBe(2);
    expect(segmentAt(-10, 4)).toBe(0);
    expect(segmentAt(-100, 4)).toBe(1);
    expect(segmentAt(720 + 100, 4)).toBe(2);
  });
});

describe("planSpin", () => {
  it("la rotation planifiée amène bien le gagnant sous le pointeur", () => {
    for (const seed of SEEDS) {
      for (const count of [2, 3, 7, 24]) {
        const plan = planSpin(createRng(seed), count, 1234.5);
        expect(segmentAt(plan.rotation, count)).toBe(plan.winnerIndex);
      }
    }
  });

  it("ne s'arrête jamais à moins de 15 % d'une frontière de segment", () => {
    for (const seed of SEEDS) {
      const plan = planSpin(createRng(seed), 6, 0);
      const angle = ((-plan.rotation % 360) + 360) % 360;
      const within = (angle % 60) / 60;
      expect(within).toBeGreaterThanOrEqual(0.15 - 1e-9);
      expect(within).toBeLessThanOrEqual(0.85 + 1e-9);
    }
  });

  it("tourne toujours vers l'avant, de MIN_TURNS à MAX_TURNS tours", () => {
    for (const seed of SEEDS) {
      for (const current of [0, 370, -50, 9999]) {
        const plan = planSpin(createRng(seed), 5, current);
        const turns = (plan.rotation - current) / 360;
        expect(turns).toBeGreaterThan(MIN_TURNS - 1);
        expect(turns).toBeLessThan(MAX_TURNS + 1);
      }
    }
  });

  it("chaque case peut gagner, avec une fréquence comparable", () => {
    const rng = createRng("equite");
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) counts[planSpin(rng, 4, 0).winnerIndex]++;
    for (const c of counts) expect(c).toBeGreaterThan(850);
  });
});

describe("addEntry", () => {
  it("ajoute une case nettoyée de ses espaces", () => {
    const next = addEntry(state(["Léa"]), "  Hugo ", "e9");
    expect(next).toEqual({ ...state(["Léa"]), entries: [{ id: "e1", label: "Léa" }, { id: "e9", label: "Hugo" }] });
  });

  it("refuse le vide, les doublons (casse ignorée), le trop long et la roue pleine", () => {
    expect(addEntry(state([]), "   ", "x")).toBe("empty");
    expect(addEntry(state(["Léa"]), "LÉA", "x")).toBe("duplicate");
    expect(addEntry(state([]), "a".repeat(MAX_LABEL_LENGTH + 1), "x")).toBe("tooLong");
    expect(addEntry(state([]), "a".repeat(MAX_LABEL_LENGTH), "x")).not.toBe("tooLong");
    const full = state(Array.from({ length: MAX_ENTRIES }, (_, i) => `n${i}`));
    expect(addEntry(full, "nouveau", "x")).toBe("full");
    expect(addEntry(state(Array.from({ length: MAX_ENTRIES - 1 }, (_, i) => `n${i}`)), "nouveau", "x")).not.toBe("full");
  });
});

describe("removeEntry / recordDraw", () => {
  it("removeEntry retire la case par id", () => {
    expect(removeEntry(state(["a", "b"]), "e1").entries).toEqual([{ id: "e2", label: "b" }]);
  });

  it("recordDraw ajoute le tirage en tête et garde le gagnant par défaut", () => {
    const s = { ...state(["a", "b"]), history: [{ winner: "b", date: "2026-10-01" }] };
    const next = recordDraw(s, s.entries[0], TODAY, false);
    expect(next.history).toEqual([{ winner: "a", date: TODAY }, { winner: "b", date: "2026-10-01" }]);
    expect(next.entries).toHaveLength(2);
  });

  it("recordDraw retire le gagnant si demandé", () => {
    const s = state(["a", "b"]);
    expect(recordDraw(s, s.entries[0], TODAY, true).entries).toEqual([{ id: "e2", label: "b" }]);
  });

  it("recordDraw plafonne l'historique", () => {
    const s = { ...state(["a"]), history: Array.from({ length: MAX_HISTORY }, () => ({ winner: "x", date: "2026-01-01" })) };
    const next = recordDraw(s, s.entries[0], TODAY, false);
    expect(next.history).toHaveLength(MAX_HISTORY);
    expect(next.history[0].winner).toBe("a");
  });
});

describe("segmentHue", () => {
  it("donne des teintes entières dans [0, 360[ et distinctes pour des voisins", () => {
    expect(segmentHue(0)).toBe(200);
    expect(segmentHue(1)).toBe(338);
    expect(segmentHue(2)).toBe(115);
    for (let i = 0; i < 24; i++) {
      expect(segmentHue(i)).toBeGreaterThanOrEqual(0);
      expect(segmentHue(i)).toBeLessThan(360);
    }
  });
});
