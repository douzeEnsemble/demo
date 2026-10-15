import { describe, expect, it } from "vitest";
import { createRng, hashString } from "./random";

describe("hashString", () => {
  it("est déterministe et distingue des chaînes proches", () => {
    expect(hashString("ABC")).toBe(hashString("ABC"));
    expect(hashString("ABC")).not.toBe(hashString("ABD"));
  });

  it("vaut la base FNV-1a pour une chaîne vide", () => {
    expect(hashString("")).toBe(0x811c9dc5);
  });

  it("correspond à FNV-1a 32 bits (valeur de référence)", () => {
    expect(hashString("a")).toBe(0xe40c292c);
    expect(hashString("foobar")).toBe(0xbf9cf968);
  });
});

describe("createRng", () => {
  it("redonne la même suite pour la même graine", () => {
    const a = createRng("K7P2QX");
    const b = createRng("K7P2QX");
    expect(Array.from({ length: 5 }, a.next)).toEqual(Array.from({ length: 5 }, b.next));
  });

  it("donne une suite différente pour une autre graine", () => {
    expect(createRng("A").next()).not.toBe(createRng("B").next());
  });

  it("next reste dans [0, 1[ et se répartit à peu près uniformément", () => {
    const rng = createRng("uniforme");
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[Math.floor(v * 4)]++;
    }
    for (const count of buckets) expect(count).toBeGreaterThan(850);
  });

  it("int couvre exactement [min, max]", () => {
    const rng = createRng("int");
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rng.int(3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it("int(min, min) renvoie toujours min", () => {
    expect(createRng("x").int(7, 7)).toBe(7);
  });

  it("chance respecte ses bornes et sa probabilité", () => {
    const rng = createRng("chance");
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (rng.chance(0.25)) hits++;
    expect(hits).toBeGreaterThan(400);
    expect(hits).toBeLessThan(600);
  });

  it("pick renvoie un élément du tableau, tous finissent par sortir", () => {
    const rng = createRng("pick");
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(rng.pick(["a", "b", "c"]));
    expect([...seen].sort()).toEqual(["a", "b", "c"]);
  });

  it("weighted respecte les poids (poids nul jamais tiré)", () => {
    const rng = createRng("weighted");
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 3000; i++) counts[rng.weighted([["a", 1], ["b", 3], ["c", 0]] as const)]++;
    expect(counts.c).toBe(0);
    expect(counts.b / counts.a).toBeGreaterThan(2.4);
    expect(counts.b / counts.a).toBeLessThan(3.6);
  });

  it("weighted retombe sur la dernière entrée si l'arrondi épuise le tirage", () => {
    // Somme des poids nulle : aucune entrée ne fait passer le reste sous 0.
    expect(createRng("w").weighted([["a", 0], ["b", 0]] as const)).toBe("b");
  });

  it("shuffle renvoie une permutation sans modifier l'original", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = createRng("shuffle").shuffle(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort()).toEqual(items);
    expect(shuffled).not.toEqual(items);
  });

  it("shuffle peut placer chaque élément à chaque position", () => {
    const rng = createRng("positions");
    const firsts = new Set<number>();
    const lasts = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const s = rng.shuffle([1, 2, 3]);
      firsts.add(s[0]);
      lasts.add(s[2]);
    }
    expect(firsts.size).toBe(3);
    expect(lasts.size).toBe(3);
  });

  it("sample renvoie des éléments distincts, au plus la taille du tableau", () => {
    const rng = createRng("sample");
    const picked = rng.sample(["a", "b", "c", "d"], 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    expect(rng.sample(["a", "b"], 5)).toHaveLength(2);
  });
});
