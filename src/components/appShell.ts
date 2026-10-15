import type { DemoApp } from "../apps";
import { escapeHtml } from "../lib/dom";
import { icons } from "../lib/icons";
import { preferenceTogglesHtml, wirePreferenceToggles } from "./preferenceToggles";

export interface AppShellOptions {
  app: DemoApp;
  seed: string;
  onHome: () => void;
  onRegenerate: () => void;
}

/** En-tête commun à toutes les démos (retour à l'accueil, titre, graine du
 * jeu de données, « Nouvelles données », préférences d'affichage). Renvoie
 * l'élément dans lequel la démo elle-même doit se rendre : une démo ne
 * touche jamais à l'en-tête, et l'en-tête ne sait rien du contenu. */
export function renderAppShell(root: HTMLElement, opts: AppShellOptions): HTMLElement {
  const { app, seed } = opts;
  root.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <button type="button" class="icon-btn" id="shell-home" aria-label="Retour à l'accueil" title="Retour à l'accueil">${icons.back}</button>
        <h1 class="app-title"><span class="app-title-icon">${icons[app.icon]}</span>${escapeHtml(app.name)}</h1>
        <div class="app-header-actions">${preferenceTogglesHtml()}</div>
      </header>
      <div class="dataset-bar">
        <span class="seed-chip" title="Même graine, mêmes données : recharger ou partager ce lien redonne exactement ce jeu de données.">
          Jeu de données <strong id="shell-seed">${escapeHtml(seed)}</strong>
        </span>
        <button type="button" class="btn small" id="shell-regenerate">${icons.refresh}<span>Nouvelles données</span></button>
      </div>
      <main class="app-content" id="app-content"></main>
    </div>
  `;
  wirePreferenceToggles(root.querySelector(".app-header-actions")!);
  root.querySelector("#shell-home")!.addEventListener("click", opts.onHome);
  root.querySelector("#shell-regenerate")!.addEventListener("click", opts.onRegenerate);
  return root.querySelector<HTMLElement>("#app-content")!;
}
