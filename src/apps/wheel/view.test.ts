// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRng } from "../../lib/random";
import { generateWheel, MAX_ENTRIES, planSpin } from "./generator";
import { mountWheel, SPIN_MS, wheelSvg } from "./view";

const ctx = { seed: "ROUE01", today: "2026-10-15" };

describe("wheelSvg", () => {
  it("affiche un message tant qu'il y a moins de 2 cases", () => {
    expect(wheelSvg([{ id: "e1", label: "Seul" }])).toContain("Ajoute au moins 2 cases");
  });

  it("dessine un segment et un libellé échappé par case", () => {
    const svg = wheelSvg([
      { id: "e1", label: "<b>A</b>" },
      { id: "e2", label: "B" },
    ]);
    expect(svg.match(/class="wheel-segment"/g)).toHaveLength(2);
    expect(svg).toContain("&lt;b&gt;A&lt;/b&gt;");
    expect(svg).not.toContain("<b>");
  });

  it("tronque les libellés trop longs pour tenir dans un segment", () => {
    expect(wheelSvg([{ id: "1", label: "Un libellé beaucoup trop long" }, { id: "2", label: "b" }])).toContain("Un libellé b…");
  });
});

describe("mountWheel", () => {
  let root: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.removeAttribute("data-reduce-motion");
    root = document.createElement("div");
    document.body.replaceChildren(root);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const expected = generateWheel(createRng(ctx.seed), ctx.today);
  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const spinButton = () => q<HTMLButtonElement>("#wheel-spin");

  it("affiche la question, les cases et l'historique générés pour la graine", () => {
    mountWheel(root, ctx);
    expect(q("#wheel-title").textContent).toBe(expected.title);
    expect(root.querySelectorAll(".chip")).toHaveLength(expected.entries.length);
    expect(root.querySelectorAll(".wheel-segment")).toHaveLength(expected.entries.length);
    expect(root.querySelectorAll("#wheel-history li")).toHaveLength(expected.history.length);
    expect(q("#wheel-entries-title").textContent).toBe(`Cases (${expected.entries.length})`);
  });

  it("fait tourner la roue puis annonce le gagnant prévu par la graine du tirage", () => {
    mountWheel(root, ctx);
    const plan = planSpin(createRng(`${ctx.seed}:spin:1`), expected.entries.length, 0);
    const winner = expected.entries[plan.winnerIndex].label;

    spinButton().click();
    expect(spinButton().disabled).toBe(true);
    expect(spinButton().textContent).toBe("La roue tourne…");
    expect(q<SVGGElement>("#wheel-rotor").style.transform).toBe(`rotate(${plan.rotation}deg)`);
    expect(q<SVGGElement>("#wheel-rotor").style.transition).toContain(`${SPIN_MS}ms`);
    expect(root.querySelector<HTMLButtonElement>(".chip-remove")!.disabled).toBe(true);

    vi.advanceTimersByTime(SPIN_MS);
    expect(q("#wheel-result").textContent).toContain(`${winner} est tiré !`);
    expect(spinButton().disabled).toBe(false);
    expect(root.querySelector("#wheel-history li strong")!.textContent).toBe(winner);
    expect(root.querySelectorAll(".chip")).toHaveLength(expected.entries.length);
  });

  it("enchaîne les tirages en continuant de tourner vers l'avant", () => {
    mountWheel(root, ctx);
    spinButton().click();
    vi.advanceTimersByTime(SPIN_MS);
    const first = planSpin(createRng(`${ctx.seed}:spin:1`), expected.entries.length, 0);
    const second = planSpin(createRng(`${ctx.seed}:spin:2`), expected.entries.length, first.rotation);
    spinButton().click();
    expect(q<SVGGElement>("#wheel-rotor").style.transform).toBe(`rotate(${second.rotation}deg)`);
  });

  it("retire le gagnant de la roue si l'option est cochée, et remet la roue à zéro", () => {
    mountWheel(root, ctx);
    const option = q<HTMLInputElement>("#wheel-remove-winner");
    option.checked = true;
    option.dispatchEvent(new Event("change"));
    spinButton().click();
    vi.advanceTimersByTime(SPIN_MS);
    expect(q("#wheel-result").textContent).toContain("(retiré de la roue)");
    expect(root.querySelectorAll(".chip")).toHaveLength(expected.entries.length - 1);
    expect(q<SVGGElement>("#wheel-rotor").style.transform).toBe("rotate(0deg)");
    expect(q<SVGGElement>("#wheel-rotor").style.transition).toBe("none");
  });

  it("s'arrête instantanément en mode animations réduites", () => {
    document.documentElement.setAttribute("data-reduce-motion", "");
    mountWheel(root, ctx);
    spinButton().click();
    expect(q<SVGGElement>("#wheel-rotor").style.transition).toBe("none");
    vi.advanceTimersByTime(0);
    expect(q("#wheel-result").textContent).toContain("est tiré");
  });

  it("respecte aussi la préférence système de réduction des animations", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    mountWheel(root, ctx);
    spinButton().click();
    expect(q<SVGGElement>("#wheel-rotor").style.transition).toBe("none");
    delete (window as Partial<Window>).matchMedia;
  });

  it("ajoute une case, vide le champ et masque l'erreur", () => {
    mountWheel(root, ctx);
    q<HTMLInputElement>("#wheel-add-input").value = "Nouvelle case";
    q<HTMLFormElement>("#wheel-add-form").requestSubmit();
    expect(root.querySelectorAll(".chip")).toHaveLength(expected.entries.length + 1);
    expect(q<HTMLInputElement>("#wheel-add-input").value).toBe("");
    expect(q("#wheel-add-error").hidden).toBe(true);
    // La case suivante reçoit un nouvel id (retirable indépendamment).
    q<HTMLInputElement>("#wheel-add-input").value = "Encore une";
    q<HTMLFormElement>("#wheel-add-form").requestSubmit();
    const ids = Array.from(root.querySelectorAll<HTMLElement>(".chip-remove"), (b) => b.dataset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("affiche une erreur explicite pour une case refusée", () => {
    mountWheel(root, ctx);
    q<HTMLInputElement>("#wheel-add-input").value = expected.entries[0].label;
    q<HTMLFormElement>("#wheel-add-form").requestSubmit();
    expect(q("#wheel-add-error").hidden).toBe(false);
    expect(q("#wheel-add-error").textContent).toBe("Ce nom est déjà sur la roue.");
    for (let i = 0; i < MAX_ENTRIES; i++) {
      q<HTMLInputElement>("#wheel-add-input").value = `n${i}`;
      q<HTMLFormElement>("#wheel-add-form").requestSubmit();
    }
    expect(q("#wheel-add-error").textContent).toContain("La roue est pleine");
  });

  it("retire une case, et désactive le tirage sous 2 cases", () => {
    mountWheel(root, ctx);
    while (root.querySelectorAll(".chip").length > 1) root.querySelector<HTMLButtonElement>(".chip-remove")!.click();
    expect(spinButton().disabled).toBe(true);
    expect(root.querySelector(".wheel-empty")).not.toBeNull();
    // Un clic ailleurs que sur un bouton de retrait ne fait rien.
    q("#wheel-entries").click();
    expect(root.querySelectorAll(".chip")).toHaveLength(1);
  });

  it("indique l'absence de tirage quand l'historique est vide", async () => {
    const generator = await import("./generator");
    const spy = vi.spyOn(generator, "generateWheel").mockReturnValue({ ...expected, history: [] });
    mountWheel(root, ctx);
    expect(q("#wheel-history").textContent).toContain("Aucun tirage pour l'instant.");
    spy.mockRestore();
  });

  it("le nettoyage annule un tirage en cours", () => {
    const cleanup = mountWheel(root, ctx);
    spinButton().click();
    cleanup();
    vi.advanceTimersByTime(SPIN_MS);
    expect(q("#wheel-result").textContent).toBe("");
  });
});
