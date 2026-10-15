// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderAppShell } from "./appShell";
import type { DemoApp } from "../apps";

const app: DemoApp = { slug: "roue", name: "Roue <de> tirage", tagline: "", icon: "wheel", load: async () => () => () => {} };

describe("renderAppShell", () => {
  it("rend l'en-tête et renvoie la zone de contenu de la démo", () => {
    const root = document.createElement("div");
    const content = renderAppShell(root, { app, seed: "K7P2QX", onHome: () => {}, onRegenerate: () => {} });
    expect(content.id).toBe("app-content");
    expect(root.contains(content)).toBe(true);
    expect(root.querySelector(".app-title")!.innerHTML).toContain("Roue &lt;de&gt; tirage");
    expect(root.querySelector("#shell-seed")!.textContent).toBe("K7P2QX");
    expect(root.querySelector("#theme-toggle")).not.toBeNull();
  });

  it("branche retour à l'accueil et « Nouvelles données »", () => {
    const root = document.createElement("div");
    const onHome = vi.fn();
    const onRegenerate = vi.fn();
    renderAppShell(root, { app, seed: "A", onHome, onRegenerate });
    root.querySelector<HTMLButtonElement>("#shell-home")!.click();
    root.querySelector<HTMLButtonElement>("#shell-regenerate")!.click();
    expect(onHome).toHaveBeenCalledOnce();
    expect(onRegenerate).toHaveBeenCalledOnce();
  });
});
