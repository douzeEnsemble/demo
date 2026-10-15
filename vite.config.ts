import { defineConfig } from "vite";

// "/" sur Cloudflare Workers (servi à la racine du domaine) ; sous-chemin du
// dépôt (ex: "/demo/") sur GitHub Pages, où l'app est servie depuis un dépôt
// de projet plutôt qu'un domaine dédié — voir VITE_BASE_PATH dans
// .github/workflows/pages.yml et src/lib/basePath.ts pour le routeur.
//
// Pas de @cloudflare/vite-plugin ici, contrairement aux autres projets : les
// démos n'ont aucun code serveur (toutes les données sont générées côté
// client à partir d'une graine, voir src/lib/random.ts), Cloudflare ne sert
// que les assets statiques de dist/ (voir wrangler.json).
const base = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base,
});
