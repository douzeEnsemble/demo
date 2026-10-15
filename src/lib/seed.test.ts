import { describe, expect, it } from "vitest";
import { isValidSeed, randomSeed, readSeed, SEED_CHARS, SEED_LENGTH } from "./seed";

describe("randomSeed", () => {
  it("produit une graine de la bonne longueur, dans l'alphabet sans ambiguïté", () => {
    const seed = randomSeed();
    expect(seed).toHaveLength(SEED_LENGTH);
    for (const c of seed) expect(SEED_CHARS).toContain(c);
  });

  it("projette chaque valeur aléatoire sur l'alphabet (modulo)", () => {
    expect(randomSeed(() => [0, 1, 30, 31, 32, 61])).toBe("AB9AB9");
  });

  it("demande exactement SEED_LENGTH valeurs", () => {
    let asked = 0;
    randomSeed((count) => {
      asked = count;
      return new Array(count).fill(0);
    });
    expect(asked).toBe(SEED_LENGTH);
  });

  it("n'utilise aucun caractère ambigu (0, O, 1, I, L)", () => {
    expect(SEED_CHARS).not.toMatch(/[0O1IL]/);
  });
});

describe("isValidSeed", () => {
  it("accepte lettres, chiffres et tirets jusqu'à 32 caractères", () => {
    expect(isValidSeed("K7P2QX")).toBe(true);
    expect(isValidSeed("ma-demo-2")).toBe(true);
    expect(isValidSeed("a".repeat(32))).toBe(true);
  });

  it("refuse le vide, les caractères spéciaux et les graines trop longues", () => {
    expect(isValidSeed("")).toBe(false);
    expect(isValidSeed("<script>")).toBe(false);
    expect(isValidSeed("a b")).toBe(false);
    expect(isValidSeed("a".repeat(33))).toBe(false);
  });
});

describe("readSeed", () => {
  it("lit la graine de l'URL et la passe en majuscules", () => {
    expect(readSeed(new URL("https://x.test/roue?seed=k7p2qx"))).toBe("K7P2QX");
  });

  it("renvoie null si la graine est absente ou invalide", () => {
    expect(readSeed(new URL("https://x.test/roue"))).toBeNull();
    expect(readSeed(new URL("https://x.test/roue?seed=%3Cb%3E"))).toBeNull();
  });
});
