// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRng } from "../../lib/random";
import * as generator from "./generator";
import { mountPoll } from "./view";

const ctx = { seed: "SONDAGE", today: "2026-10-15" };
const base = generator.generatePoll(createRng(ctx.seed), ctx.today);

function fixture(overrides: Partial<generator.PollState> = {}): generator.PollState {
  return {
    question: "Quel <thème> ?",
    description: "Une description",
    multiple: false,
    options: [
      { id: "o1", label: "Pirates" },
      { id: "o2", label: "Western" },
    ],
    votes: [{ voter: "Léa Martin", choices: ["o1"], date: "2026-10-10" }],
    closesOn: "2026-10-20",
    closed: false,
    ...overrides,
  };
}

describe("mountPoll", () => {
  let root: HTMLElement;
  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;

  beforeEach(() => {
    vi.restoreAllMocks();
    root = document.createElement("div");
    document.body.replaceChildren(root);
  });

  function vote(name: string, ...labels: string[]): void {
    q<HTMLInputElement>("#poll-voter").value = name;
    for (const label of labels) {
      const input = Array.from(root.querySelectorAll<HTMLInputElement>("input[name=choice]")).find(
        (i) => i.nextElementSibling!.textContent === label,
      )!;
      input.checked = true;
    }
    q<HTMLFormElement>("#poll-form").requestSubmit();
  }

  it("affiche la question générée, une réponse par option et les résultats", () => {
    mountPoll(root, ctx);
    expect(root.querySelector("h2")!.textContent).toBe(base.question);
    expect(root.querySelectorAll("input[name=choice]")).toHaveLength(base.options.length);
    expect(root.querySelectorAll(".result")).toHaveLength(base.options.length);
    expect(root.querySelectorAll(".result.leading").length).toBeGreaterThanOrEqual(1);
    expect(q("#poll-meta").textContent).toContain(`${base.votes.length} votants`);
    expect(root.querySelectorAll("#poll-recent li")).toHaveLength(8);
  });

  it("échappe le texte et utilise des boutons radio pour un choix unique", () => {
    vi.spyOn(generator, "generatePoll").mockReturnValue(fixture());
    mountPoll(root, ctx);
    expect(root.querySelector("h2")!.innerHTML).toBe("Quel &lt;thème&gt; ?");
    expect(root.querySelectorAll("input[type=radio]")).toHaveLength(2);
    expect(q("#poll-meta").textContent).toContain("Une seule réponse");
    expect(q("#poll-meta").textContent).toContain("1 votant");
    expect(q("#poll-meta").textContent).toContain("Clôture le mardi 20 octobre 2026");
  });

  it("utilise des cases à cocher pour un choix multiple", () => {
    vi.spyOn(generator, "generatePoll").mockReturnValue(fixture({ multiple: true }));
    mountPoll(root, ctx);
    expect(root.querySelectorAll("input[type=checkbox]")).toHaveLength(2);
    expect(q("#poll-meta").textContent).toContain("Jusqu'à 3 réponses");
  });

  it("enregistre un vote, met à jour les résultats et remercie", () => {
    vi.spyOn(generator, "generatePoll").mockReturnValue(fixture());
    mountPoll(root, ctx);
    vote("Hugo", "Western");
    expect(q("#poll-message").textContent).toBe("Merci Hugo, ton vote est enregistré !");
    expect(q("#poll-message").className).toBe("form-message success");
    expect(q("#poll-results").textContent).toContain("1 voix · 50 %");
    expect(root.querySelectorAll(".result.leading")).toHaveLength(2);
    expect(q("#poll-recent li").textContent).toContain("Hugo");
    expect(q("#poll-recent li").textContent).toContain("Western");
    expect(q<HTMLInputElement>("#poll-voter").value).toBe("");
  });

  it("met à jour le vote d'une personne qui revote", () => {
    vi.spyOn(generator, "generatePoll").mockReturnValue(fixture());
    mountPoll(root, ctx);
    vote("lea martin", "Western");
    expect(q("#poll-message").textContent).toBe("Vote de lea martin mis à jour.");
    expect(q("#poll-meta").textContent).toContain("1 votant");
  });

  it("explique pourquoi un vote est refusé", () => {
    vi.spyOn(generator, "generatePoll").mockReturnValue(fixture());
    mountPoll(root, ctx);
    vote("Hugo");
    expect(q("#poll-message").textContent).toBe("Choisis au moins une réponse.");
    expect(q("#poll-message").className).toBe("form-message error");
    vote("", "Pirates");
    expect(q("#poll-message").textContent).toBe("Indique ton nom pour voter.");
  });

  it("clôt puis rouvre le sondage", () => {
    vi.spyOn(generator, "generatePoll").mockReturnValue(fixture());
    mountPoll(root, ctx);
    vote("", "Pirates");
    q<HTMLButtonElement>("#poll-toggle-closed").click();
    expect(q("#poll-message").hidden).toBe(true);
    expect(q("#poll-meta").textContent).toContain("Clos");
    expect(q<HTMLButtonElement>("#poll-submit").disabled).toBe(true);
    expect(q("#poll-toggle-closed").textContent).toBe("Rouvrir");
    q<HTMLButtonElement>("#poll-toggle-closed").click();
    expect(q<HTMLButtonElement>("#poll-submit").disabled).toBe(false);
    expect(q("#poll-toggle-closed").textContent).toBe("Clore le sondage");
  });

  it("indique l'absence de votes", () => {
    vi.spyOn(generator, "generatePoll").mockReturnValue(fixture({ votes: [] }));
    mountPoll(root, ctx);
    expect(q("#poll-recent").textContent).toContain("Aucun vote pour l'instant.");
  });

  it("renvoie un nettoyage sans effet", () => {
    expect(mountPoll(root, ctx)()).toBeUndefined();
  });
});
