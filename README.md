# Démos

Une vitrine de petites applications de démonstration : une page d'accueil
pour choisir une application, puis l'application elle-même. Chaque démo
fonctionne avec des **données fictives mais cohérentes**, générées dans le
navigateur à partir d'une graine — rien n'est envoyé ni enregistré sur un
serveur.

## Les démos

- **Roue de tirage** (`/roue`) : une roue à faire tourner pour désigner un
  gagnant au hasard. Cases ajoutables/retirables, tirage avec ou sans remise,
  historique des tirages.
- **Sondage** (`/sondage`) : une question à choix unique ou multiples, des
  votes existants, le vote (ou la modification de son vote), les résultats en
  barres, la clôture/réouverture du sondage.
- **Gestion de stock** (`/stock`) : l'inventaire d'une boutique (épicerie
  fine, papeterie ou jardinerie), indicateurs (valeur, stocks bas, ruptures),
  recherche et filtres, entrées/sorties et réapprovisionnement, historique des
  mouvements par produit.
- **Réservation de repas** (`/repas`) : un repas à organiser (date, lieu,
  capacité), réservation avec choix des menus et allergies, jauge de
  remplissage, récapitulatif pour la cuisine, suivi des paiements, annulation.

## Données fictives et graine

Chaque démo tire son jeu de données d'un générateur pseudo-aléatoire
déterministe (`src/lib/random.ts`) initialisé par une **graine** visible dans
l'URL (`/stock?seed=K7P2QX`) et dans l'en-tête de la démo :

- recharger la page ou partager le lien redonne **exactement** les mêmes
  données ;
- « Nouvelles données » tire une nouvelle graine (le bouton précédent du
  navigateur ramène à la précédente) ;
- n'importe quelle graine saisie à la main (lettres, chiffres, tirets) est
  acceptée.

Les données ne sont pas tirées champ par champ au hasard, mais construites
pour rester vraisemblables :

- les stocks finaux résultent d'une simulation jour par jour des 30 derniers
  jours (ventes, réceptions au seuil, casse, fournisseurs en retard) : chaque
  mouvement de l'historique aboutit exactement à la quantité affichée ;
- les réservations ne dépassent jamais la capacité, comptent toujours au
  moins un adulte, et leurs e-mails sont dérivés du nom (sur `example.org`) ;
- les votes d'un sondage suivent une popularité propre à chaque option (un
  favori, des outsiders), chaque votant est unique ;
- les tirages passés de la roue suivent la cadence de la question (les
  croissants le vendredi, la vaisselle chaque soir…).

Les manipulations faites dans une démo (votes, réservations, mouvements…)
restent en mémoire le temps de la visite : recharger revient au jeu de
données d'origine de la graine.

## Stack technique

- [Vite](https://vite.dev/) + TypeScript, sans framework front (DOM direct,
  gabarits HTML en template literals) pour rester léger — mêmes conventions
  que KoiKiManke, DansMaHotte et OnMangeQuoi.
- Aucun code serveur : l'app est un site statique, servi par
  [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/)
  (assets statiques uniquement) et par GitHub Pages.

## Démarrer en local

```bash
npm install
npm run dev
```

Ouvre l'URL affichée (`http://localhost:5173` par défaut).

## Déployer

- **Cloudflare** : `npm run deploy` (build puis `wrangler deploy`, nécessite
  `npx wrangler login` la première fois). En CI, `.github/workflows/deploy.yml`
  le fait après chaque CI verte sur `main` (secrets `CLOUDFLARE_API_TOKEN` et
  `CLOUDFLARE_ACCOUNT_ID`, variable optionnelle `DEPLOY_URL` pour la
  vérification post-déploiement).
- **GitHub Pages** : `.github/workflows/pages.yml`, après chaque CI verte sur
  `main`, une fois Pages activé (Settings → Pages → Source : « GitHub
  Actions »). L'app y est servie sous `/<nom-du-dépôt>/` (voir
  `VITE_BASE_PATH`).

## Ajouter une démo

1. Créer `src/apps/<nom>/generator.ts` : types, générateur pur
   `generateXxx(rng, today)` et opérations pures (validation, calculs), avec
   son `generator.test.ts`.
2. Créer `src/apps/<nom>/view.ts` : `mountXxx(root, { seed, today })` qui
   rend la démo et renvoie sa fonction de nettoyage, avec son `view.test.ts`.
3. L'enregistrer dans `src/apps.ts` (slug, nom, accroche, icône) : l'accueil
   et le routeur s'en déduisent.
4. Ajouter le générateur et son test à `stryker.config.mjs`, et un parcours
   e2e dans `e2e/apps.spec.ts`.

## Structure du projet

```
src/main.ts         Routeur (accueil / démo), gestion de la graine dans l'URL
src/apps.ts         Registre des démos
src/apps/<démo>/    generator.ts (données + logique pures) et view.ts (rendu)
src/components/     En-tête commun des démos, préférences, modale accessibilité
src/lib/            Générateur à graine, réservoirs communs (personnes…),
                    formats (dates, montants), thème, accessibilité…
e2e/                Tests fonctionnels Playwright
wrangler.json       Configuration Cloudflare (assets statiques, repli SPA)
```

## Qualité et CI/CD

```bash
npm run lint          # oxlint
npm run typecheck
npm run test:coverage # Vitest — tout src/, 100% de couverture
npm run test:mutation # Stryker — mutation testing sur la logique pure
                       # (générateurs et src/lib/{random,seed,fake,format}.ts)
npm run test:e2e      # Playwright, contre `vite dev`
```

`.github/workflows/` : `ci.yml` (lint, typecheck, tests + couverture,
mutation testing, e2e, audit, build), `deploy.yml` (Cloudflare) et `pages.yml`
(GitHub Pages), tous deux gatés sur la réussite de la CI via `workflow_run`.
Dependabot et CodeQL sont aussi configurés.
