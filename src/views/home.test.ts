// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_APPS } from "../apps";
import { mountHomeView } from "./home";

describe("mountHomeView", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.replaceChildren(root);
  });

  it("liste une carte par démo, avec un vrai lien", () => {
    mountHomeView(root, () => {});
    const cards = root.querySelectorAll<HTMLAnchorElement>(".app-card");
    expect(cards).toHaveLength(DEMO_APPS.length);
    expect(cards[0].getAttribute("href")).toBe(`/${DEMO_APPS[0].slug}`);
    expect(cards[0].textContent).toContain(DEMO_APPS[0].name);
    expect(root.querySelector("#theme-toggle")).not.toBeNull();
  });

  it("navigue sans recharger sur un clic simple", () => {
    const navigate = vi.fn();
    mountHomeView(root, navigate);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    root.querySelector(".app-card")!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith(`/${DEMO_APPS[0].slug}`);
  });

  it("laisse le navigateur gérer clic du milieu et clics avec modificateur (nouvel onglet…)", () => {
    const navigate = vi.fn();
    mountHomeView(root, navigate);
    const link = root.querySelector(".app-card")!;
    for (const init of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
      // jsdom suivrait le lien (navigation non implémentée) : on l'en empêche
      // après coup, en vérifiant d'abord que la vue ne l'a pas fait.
      link.addEventListener("click", (e) => {
        expect(e.defaultPrevented).toBe(false);
        e.preventDefault();
      }, { once: true });
      link.dispatchEvent(event);
    }
    expect(navigate).not.toHaveBeenCalled();
  });

  it("renvoie un nettoyage sans effet", () => {
    expect(mountHomeView(root, () => {})()).toBeUndefined();
  });
});
