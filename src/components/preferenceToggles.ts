import { icons } from "../lib/icons";
import { cycleThemePreference, getThemePreference, themeLabel, type ThemePreference } from "../lib/theme";
import { openAccessibilityModal } from "./accessibilityModal";

const THEME_ICON: Record<ThemePreference, string> = { system: icons.themeAuto, light: icons.sun, dark: icons.moon };

function themeButtonInner(theme: ThemePreference): string {
  return THEME_ICON[theme];
}

/** Boutons accessibilité + thème, identiques sur l'accueil et dans chaque
 * démo (mêmes préférences par appareil, voir theme.ts et
 * accessibilityPreference.ts). */
export function preferenceTogglesHtml(): string {
  const theme = getThemePreference();
  return `
    <button type="button" class="icon-btn" id="a11y-toggle" aria-label="Accessibilité" title="Accessibilité">
      ${icons.accessibility}
    </button>
    <button type="button" class="icon-btn" id="theme-toggle" aria-label="Thème : ${themeLabel(theme)}" title="Thème : ${themeLabel(theme)}">
      ${themeButtonInner(theme)}
    </button>
  `;
}

export function wirePreferenceToggles(container: HTMLElement): void {
  const themeButton = container.querySelector<HTMLButtonElement>("#theme-toggle")!;
  themeButton.addEventListener("click", () => {
    const next = cycleThemePreference();
    const label = `Thème : ${themeLabel(next)}`;
    themeButton.setAttribute("aria-label", label);
    themeButton.title = label;
    themeButton.innerHTML = themeButtonInner(next);
  });
  container.querySelector("#a11y-toggle")!.addEventListener("click", openAccessibilityModal);
}
