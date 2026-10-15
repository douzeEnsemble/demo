import { describe, expect, it } from "vitest";
import { createRng } from "../../lib/random";
import { castVote, generatePoll, MAX_MULTIPLE_CHOICES, MAX_VOTER_LENGTH, setClosed, tally, type PollState } from "./generator";

const TODAY = "2026-10-15";
const SEEDS = Array.from({ length: 40 }, (_, i) => `P${i}`);

function poll(overrides: Partial<PollState> = {}): PollState {
  return {
    question: "Q ?",
    description: "",
    multiple: false,
    options: [
      { id: "o1", label: "Un" },
      { id: "o2", label: "Deux" },
      { id: "o3", label: "Trois" },
      { id: "o4", label: "Quatre" },
    ],
    votes: [],
    closesOn: "2026-10-20",
    closed: false,
    ...overrides,
  };
}

describe("generatePoll", () => {
  it("est déterministe pour une graine donnée", () => {
    expect(generatePoll(createRng("A"), TODAY)).toEqual(generatePoll(createRng("A"), TODAY));
  });

  it("produit des votes valides : votants uniques, choix existants et en nombre autorisé", () => {
    for (const seed of SEEDS) {
      const p = generatePoll(createRng(seed), TODAY);
      const ids = p.options.map((o) => o.id);
      expect(new Set(p.votes.map((v) => v.voter)).size).toBe(p.votes.length);
      expect(p.votes.length).toBeGreaterThanOrEqual(12);
      for (const v of p.votes) {
        expect(new Set(v.choices).size).toBe(v.choices.length);
        expect(v.choices.length).toBeGreaterThanOrEqual(1);
        expect(v.choices.length).toBeLessThanOrEqual(p.multiple ? MAX_MULTIPLE_CHOICES : 1);
        for (const c of v.choices) expect(ids).toContain(c);
      }
    }
  });

  it("date les votes dans le passé, triés, et la clôture dans le futur", () => {
    for (const seed of SEEDS) {
      const p = generatePoll(createRng(seed), TODAY);
      expect(p.closesOn > TODAY).toBe(true);
      expect(p.closed).toBe(false);
      p.votes.forEach((v, i) => {
        expect(v.date <= TODAY).toBe(true);
        if (i > 0) expect(v.date >= p.votes[i - 1].date).toBe(true);
      });
    }
  });

  it("couvre les scénarios à choix unique et multiples", () => {
    const kinds = new Set(SEEDS.map((s) => generatePoll(createRng(s), TODAY).multiple));
    expect(kinds).toEqual(new Set([true, false]));
  });

  it("dégage le plus souvent un favori net (résultats non uniformes)", () => {
    let contrasted = 0;
    for (const seed of SEEDS) {
      const rows = tally(generatePoll(createRng(seed), TODAY));
      if (rows[0].count >= 2 * rows[rows.length - 1].count) contrasted++;
    }
    expect(contrasted).toBeGreaterThan(SEEDS.length / 2);
  });
});

describe("tally", () => {
  it("ne désigne aucun gagnant tant que personne n'a voté", () => {
    const rows = tally(poll());
    expect(rows.every((r) => r.count === 0 && r.percent === 0 && !r.leading)).toBe(true);
    expect(rows.map((r) => r.option.id)).toEqual(["o1", "o2", "o3", "o4"]);
  });

  it("compte, calcule les pourcentages et trie par voix décroissantes", () => {
    const rows = tally(
      poll({
        votes: [
          { voter: "a", choices: ["o2"], date: TODAY },
          { voter: "b", choices: ["o2"], date: TODAY },
          { voter: "c", choices: ["o3"], date: TODAY },
        ],
      }),
    );
    expect(rows.map((r) => [r.option.id, r.count, r.percent, r.leading])).toEqual([
      ["o2", 2, 67, true],
      ["o3", 1, 33, false],
      ["o1", 0, 0, false],
      ["o4", 0, 0, false],
    ]);
  });

  it("marque toutes les options à égalité en tête ; en choix multiples les % se rapportent aux votants", () => {
    const rows = tally(
      poll({
        multiple: true,
        votes: [
          { voter: "a", choices: ["o1", "o2"], date: TODAY },
          { voter: "b", choices: ["o1", "o2"], date: TODAY },
        ],
      }),
    );
    expect(rows.filter((r) => r.leading).map((r) => [r.option.id, r.percent])).toEqual([
      ["o1", 100],
      ["o2", 100],
    ]);
  });
});

describe("castVote", () => {
  it("enregistre un nouveau vote, nom nettoyé", () => {
    const result = castVote(poll(), "  Léa   Martin ", ["o1"], TODAY);
    expect(result).toEqual({ poll: poll({ votes: [{ voter: "Léa Martin", choices: ["o1"], date: TODAY }] }), replaced: false });
  });

  it("remplace le vote existant d'une même personne (casse et accents ignorés)", () => {
    const first = poll({ votes: [{ voter: "Léa Martin", choices: ["o1"], date: "2026-10-01" }, { voter: "Hugo", choices: ["o2"], date: "2026-10-02" }] });
    const result = castVote(first, "lea martin", ["o3"], TODAY);
    expect(result).toEqual({
      poll: poll({ votes: [{ voter: "Hugo", choices: ["o2"], date: "2026-10-02" }, { voter: "lea martin", choices: ["o3"], date: TODAY }] }),
      replaced: true,
    });
  });

  it("dédoublonne les choix répétés", () => {
    const result = castVote(poll({ multiple: true }), "a", ["o1", "o1", "o2"], TODAY);
    expect(typeof result !== "string" && result.poll.votes[0].choices).toEqual(["o1", "o2"]);
  });

  it("refuse les votes invalides", () => {
    expect(castVote(poll({ closed: true }), "a", ["o1"], TODAY)).toBe("closed");
    expect(castVote(poll(), "   ", ["o1"], TODAY)).toBe("noName");
    expect(castVote(poll(), "a".repeat(MAX_VOTER_LENGTH + 1), ["o1"], TODAY)).toBe("nameTooLong");
    expect(castVote(poll(), "a".repeat(MAX_VOTER_LENGTH), ["o1"], TODAY)).not.toBe("nameTooLong");
    expect(castVote(poll(), "a", [], TODAY)).toBe("noChoice");
    expect(castVote(poll(), "a", ["o1", "o2"], TODAY)).toBe("tooManyChoices");
    expect(castVote(poll({ multiple: true }), "a", ["o1", "o2", "o3", "o4"], TODAY)).toBe("tooManyChoices");
    expect(castVote(poll({ multiple: true }), "a", ["o1", "o2", "o3"], TODAY)).not.toBe("tooManyChoices");
    expect(castVote(poll(), "a", ["o9"], TODAY)).toBe("unknownChoice");
    expect(castVote(poll({ multiple: true }), "a", ["o1", "o9"], TODAY)).toBe("unknownChoice");
  });
});

describe("setClosed", () => {
  it("clôt et rouvre sans toucher aux votes", () => {
    const p = poll({ votes: [{ voter: "a", choices: ["o1"], date: TODAY }] });
    expect(setClosed(p, true)).toEqual({ ...p, closed: true });
    expect(setClosed(setClosed(p, true), false)).toEqual(p);
  });
});
