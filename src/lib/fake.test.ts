import { describe, expect, it } from "vitest";
import { createRng } from "./random";
import { emailFor, FIRST_NAMES, fullName, LAST_NAMES, mobilePhone, slugify, uniqueFirstNames, uniquePeople } from "./fake";

describe("fake", () => {
  it("fullName assemble prénom et nom", () => {
    expect(fullName({ firstName: "Léa", lastName: "Martin" })).toBe("Léa Martin");
  });

  it("uniquePeople ne produit jamais deux fois le même nom complet", () => {
    const people = uniquePeople(createRng("people"), 200);
    expect(people).toHaveLength(200);
    expect(new Set(people.map(fullName)).size).toBe(200);
    for (const p of people) {
      expect(FIRST_NAMES).toContain(p.firstName);
      expect(LAST_NAMES).toContain(p.lastName);
    }
  });

  it("uniquePeople plafonne au nombre de combinaisons possibles", () => {
    const max = FIRST_NAMES.length * LAST_NAMES.length;
    expect(uniquePeople(createRng("all"), max + 10)).toHaveLength(max);
  });

  it("uniqueFirstNames renvoie des prénoms distincts", () => {
    const names = uniqueFirstNames(createRng("prenoms"), 10);
    expect(new Set(names).size).toBe(10);
  });

  it("slugify retire accents, casse et caractères spéciaux", () => {
    expect(slugify("Lefèvre")).toBe("lefevre");
    expect(slugify("  Jean-Éric d'Arc ")).toBe("jean-eric-d-arc");
  });

  it("emailFor dérive l'adresse du nom, sur un domaine réservé", () => {
    expect(emailFor({ firstName: "Anaïs", lastName: "Guérin" })).toBe("anais.guerin@example.org");
  });

  it("mobilePhone produit un numéro de mobile français formaté", () => {
    const rng = createRng("tel");
    for (let i = 0; i < 50; i++) expect(mobilePhone(rng)).toMatch(/^0[67]( \d{2}){4}$/);
  });
});
