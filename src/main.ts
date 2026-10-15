import "./style.css";
import { findDemoApp } from "./apps";
import { renderAppShell } from "./components/appShell";
import { applyAccessibilityPreference, getAccessibilityPreference } from "./lib/accessibilityPreference";
import { appPath, routePath } from "./lib/basePath";
import { toIsoDate } from "./lib/format";
import { randomSeed, readSeed } from "./lib/seed";
import { applyTheme, getThemePreference } from "./lib/theme";

// Appliqué avant le premier rendu pour éviter un flash de thème clair suivi
// d'un bascule sombre si l'utilisateur a choisi un thème manuel.
applyTheme(getThemePreference());
applyAccessibilityPreference(getAccessibilityPreference());

const app = document.getElementById("app")!;
let cleanup: (() => void) | null = null;
// Incrémenté à chaque render() : si une navigation plus récente a démarré
// pendant qu'un chunk se chargeait, la réponse obsolète ne doit ni monter sa
// vue ni écraser `cleanup` de la navigation qui l'a entre-temps remplacée.
let renderToken = 0;

/** `path` est un chemin de l'app (« /roue »), éventuellement suivi d'une
 * query string (« /roue?seed=K7P2QX »). */
function navigate(path: string, replace = false): void {
  const [pathname, query] = path.split("?");
  const target = appPath(pathname) + (query ? `?${query}` : "");
  if (location.pathname + location.search !== target) {
    if (replace) history.replaceState({}, "", target);
    else history.pushState({}, "", target);
  }
  render();
}

// Vues chargées à la demande (import() dynamique) : l'accueil n'embarque le
// code d'aucune démo. L'ancienne vue reste affichée le temps du chargement
// (cleanup() n'est appelé qu'une fois la nouvelle prête), donc pas d'écran
// vide.
async function render(): Promise<void> {
  const token = ++renderToken;
  const slug = routePath().replace(/^\/+|\/+$/g, "");

  if (slug === "") {
    const { mountHomeView } = await import("./views/home");
    if (token !== renderToken) return;
    cleanup?.();
    cleanup = mountHomeView(app, navigate);
    document.title = "Démos";
    return;
  }

  const demo = findDemoApp(slug);
  if (!demo) {
    navigate("/", true);
    return;
  }

  // Graine absente ou invalide : on en tire une et on l'inscrit dans l'URL
  // (replaceState, pas d'entrée d'historique en plus) pour qu'un
  // rechargement ou un lien copié redonne ce même jeu de données.
  const seed = readSeed(new URL(location.href));
  if (seed === null) {
    navigate(`/${demo.slug}?seed=${randomSeed()}`, true);
    return;
  }

  const mount = await demo.load();
  if (token !== renderToken) return;
  cleanup?.();
  const content = renderAppShell(app, {
    app: demo,
    seed,
    onHome: () => navigate("/"),
    onRegenerate: () => navigate(`/${demo.slug}?seed=${randomSeed()}`),
  });
  cleanup = mount(content, { seed, today: toIsoDate(new Date()) });
  document.title = `${demo.name} · Démos`;
}

window.addEventListener("popstate", render);
render();
