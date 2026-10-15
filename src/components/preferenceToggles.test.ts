// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { preferenceTogglesHtml, wirePreferenceToggles } from "./preferenceToggles";

describe("preferenceToggles", () => {
  let container: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("reflète le thème enregistré", () => {
    localStorage.setItem("demo:theme", "dark");
    container.innerHTML = preferenceTogglesHtml();
    expect(container.querySelector("#theme-toggle")!.getAttribute("aria-label")).toBe("Thème : Sombre");
  });

  it("fait défiler les thèmes au clic et met à jour le bouton", () => {
    container.innerHTML = preferenceTogglesHtml();
    wirePreferenceToggles(container);
    const button = container.querySelector<HTMLButtonElement>("#theme-toggle")!;
    expect(button.getAttribute("aria-label")).toBe("Thème : Auto");
    button.click();
    expect(button.getAttribute("aria-label")).toBe("Thème : Clair");
    expect(button.title).toBe("Thème : Clair");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    const before = button.innerHTML;
    button.click();
    expect(button.innerHTML).not.toBe(before);
  });

  it("ouvre la modale d'accessibilité", () => {
    container.innerHTML = preferenceTogglesHtml();
    wirePreferenceToggles(container);
    container.querySelector<HTMLButtonElement>("#a11y-toggle")!.click();
    expect(document.querySelector(".accessibility-modal")).not.toBeNull();
  });
});
