import { DEMO_APPS } from "../apps";
import { preferenceTogglesHtml, wirePreferenceToggles } from "../components/preferenceToggles";
import { appPath } from "../lib/basePath";
import { escapeHtml } from "../lib/dom";
import { icons } from "../lib/icons";

export function mountHomeView(root: HTMLElement, navigate: (path: string) => void): () => void {
  root.innerHTML = `
    <div class="home">
      <div class="home-toggles">${preferenceTogglesHtml()}</div>
      <header class="home-header">
        <div class="logo">${icons.grid}</div>
        <h1>Démos</h1>
        <p class="tagline">De petites applications à essayer, alimentées par des données fictives mais cohérentes.</p>
      </header>
      <ul class="app-grid">
        ${DEMO_APPS.map(
          (app) => `
          <li>
            <a class="app-card card" href="${appPath(`/${app.slug}`)}" data-slug="${app.slug}">
              <span class="app-card-icon">${icons[app.icon]}</span>
              <span class="app-card-text">
                <strong>${escapeHtml(app.name)}</strong>
                <small>${escapeHtml(app.tagline)}</small>
              </span>
            </a>
          </li>`,
        ).join("")}
      </ul>
      <p class="home-footnote">
        Chaque démo génère son propre jeu de données à partir d'une graine visible dans l'URL :
        rien n'est envoyé ni enregistré sur un serveur, et « Nouvelles données » en tire un autre.
      </p>
    </div>
  `;
  wirePreferenceToggles(root.querySelector(".home-toggles")!);

  // Liens réels (ouvrables dans un nouvel onglet, copiables), interceptés
  // seulement pour un clic simple afin de naviguer sans recharger la page.
  root.querySelectorAll<HTMLAnchorElement>(".app-card").forEach((link) => {
    link.addEventListener("click", (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(`/${link.dataset.slug}`);
    });
  });

  return () => {};
}
