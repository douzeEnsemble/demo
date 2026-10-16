# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commandes

```bash
npm install

npm run dev            # vite dev
npm run lint           # oxlint --deny-warnings
npm run typecheck      # tsc --noEmit (un seul projet : il n'y a pas de code serveur)
npm run test           # vitest run (sans couverture)
npm run test:watch     # vitest en mode watch
npm run test:coverage  # vitest run --coverage — seuils 100% sur tout src/
npm run test:mutation  # stryker run — mutation testing sur la seule logique pure (voir Tests)
npm run test:e2e       # playwright test — démarre lui-même `vite dev` (voir playwright.config.ts)
npm run build          # npm run typecheck && vite build (sortie : dist/)
npm run preview        # vite preview
```

Lancer un seul test ou fichier :

```bash
npx vitest run src/apps/stock/generator.test.ts
npx vitest run -t "nom du test"
npx playwright test e2e/apps.spec.ts -g "nom du test"
```

Avant de pousser : lint, typecheck, test:coverage, test:mutation et test:e2e — la CI les lance en jobs indépendants et chacun bloque le déploiement.

## Architecture

Vitrine de petites applications de démonstration : un accueil qui liste les démos, puis la démo choisie. Mêmes conventions que KoiKiManke / DansMaHotte / OnMangeQuoi (TypeScript strict, Vite, pas de framework front, oxlint, Vitest 100%, Stryker, Playwright, déploiement gaté sur la CI), **sans Worker ni Durable Object** : toutes les données sont générées côté client, l'app est un site statique hébergé uniquement sur GitHub Pages (pas de Cloudflare). D'où l'absence de `@cloudflare/vite-plugin`, de `wrangler`, de `worker/`, de `shared/` et d'un second tsconfig. Si une démo a un jour besoin d'un vrai serveur (données partagées entre visiteurs), c'est à ce moment-là qu'il faudra réintroduire un Worker Cloudflare comme dans les autres projets.

### Données fictives à graine

- `src/lib/random.ts` : `createRng(seed)` (FNV-1a → mulberry32) expose `next`/`int`/`chance`/`pick`/`weighted`/`shuffle`/`sample`. **Jamais de `Math.random()`** dans les générateurs : toute donnée dérive de la graine, pour qu'une URL redonne exactement le même jeu de données (et que les tests e2e soient déterministes). La seule source d'aléa non reproductible est `randomSeed()` (`src/lib/seed.ts`), qui tire une nouvelle graine.
- La graine vit dans l'URL (`?seed=K7P2QX`). `src/main.ts` en tire une (via `replaceState`, sans entrée d'historique) quand elle est absente ou invalide ; « Nouvelles données » (`onRegenerate`) pousse une nouvelle entrée d'historique avec une nouvelle graine, donc le bouton précédent ramène au jeu d'avant. `readSeed` accepte `[A-Za-z0-9-]{1,32}` et normalise en majuscules.
- Les tirages de la roue utilisent eux aussi une graine dérivée (`${seed}:spin:${n}`) : une même URL rejoue la même suite de tirages.
- La date du jour est passée explicitement (`DemoContext.today`, chaîne ISO locale) plutôt que lue par les générateurs, qui restent purs et testables à date fixe. Les dates sont manipulées en chaînes ISO (`src/lib/format.ts` : `addDays`, `daysBetween`…), jamais en `Date` stockées, pour être indépendantes du fuseau. Les montants sont en **centimes entiers**.
- Réservoirs communs (prénoms, noms, e-mails dérivés du nom sur `example.org`, téléphones) dans `src/lib/fake.ts` ; réservoirs propres à une démo (produits, plats, questions…) dans son `generator.ts`.
- « Cohérent » est le contrat principal, vérifié par les tests des générateurs : historique de stock simulé jour par jour aboutissant au stock affiché, réservations ≤ capacité avec au moins un adulte, votants uniques et choix valides, tirages passés à la cadence du scénario… Toute nouvelle donnée générée doit avoir son invariant testé de la même façon (sur une quarantaine de graines), pas seulement un instantané.

### Démos

- Une démo = un dossier `src/apps/<nom>/` : `generator.ts` (types + générateur `generateXxx(rng, today)` + opérations pures qui renvoient un nouvel état ou un code d'erreur sous forme de chaîne, jamais d'exception) et `view.ts` (`mountXxx(root, ctx)` → fonction de nettoyage). La vue garde l'état en mémoire (`let state`), appelle les opérations pures et re-rend par `innerHTML` + délégation d'événements ; toute logique métier va dans `generator.ts`.
- `src/apps.ts` est le registre (slug, nom, accroche, icône, `load()` en import dynamique) : l'accueil (`src/views/home.ts`) et le routeur (`src/main.ts`) s'en déduisent. Ajouter une démo ne touche ni l'un ni l'autre.
- `src/components/appShell.ts` rend l'en-tête commun (retour, titre, graine, « Nouvelles données », thème, accessibilité) et renvoie l'élément où la démo se monte : une démo ne touche jamais à l'en-tête.
- Le routeur (`src/main.ts`) reprend le schéma de KoiKiManke : `renderToken` pour écarter un chargement devenu obsolète, l'ancienne vue n'est nettoyée qu'une fois la nouvelle prête. Un slug inconnu redirige vers l'accueil.
- Tout texte (y compris généré) passe par `escapeHtml()` avant d'être interpolé dans un gabarit.

### Préférences

Thème (`src/lib/theme.ts`) et accessibilité (`src/lib/accessibilityPreference.ts`, `src/components/accessibilityModal.ts`) sont repris tels quels des autres projets (clés `demo:theme`/`demo:a11y`), communs à toutes les démos. La roue respecte `data-reduce-motion` et `prefers-reduced-motion` (arrêt immédiat). `src/lib/confirmClick.ts` (confirmation au même endroit) sert à l'annulation d'une réservation.

### CI/CD

- `ci.yml` : lint, typecheck, tests + couverture, e2e, audit, mutation testing ; `build` dépend des quatre premiers. Sur une PR, `dist/` est uploadé comme artefact de prévisualisation.
- `pages.yml` (GitHub Pages, `VITE_BASE_PATH=/<dépôt>/`, `404.html` = copie d'`index.html` pour le repli SPA : ouvrir directement `/roue?seed=…` sert l'app) se déclenche via `workflow_run` après une CI verte sur `main`, jamais sur un simple push.
- `codeql.yml` sur push/PR vers `main` et chaque semaine.

### Tests

- Couverture 100% sur tout `src/` (hors `*.test.ts` et `types.ts`). Les tests DOM tournent sous `jsdom`, activé par fichier (`// @vitest-environment jsdom`). Les tests de vue utilisent le vrai générateur pour un premier rendu « de bout en bout », puis `vi.spyOn(generator, "generateXxx")` pour imposer un état de départ précis (états limites : rupture, réservations closes, historique vide…).
- `src/main.test.ts` est un scénario séquentiel unique (le module à effets de bord ne s'importe qu'une fois), mocks du registre, de l'en-tête et de `randomSeed`.
- Mutation testing (`stryker.config.mjs`) limité à la logique pure : `src/lib/{random,seed,fake,format}.ts` et `src/apps/*/generator.ts`, runner `command` avec la liste explicite des fichiers de test correspondants (à tenir synchronisée avec `mutate`). Les réservoirs de chaînes (prénoms, catalogues, scénarios) sont exclus par des commentaires `// Stryker disable … // Stryker restore all` : seul le contenu exact de ces listes est exclu, pas la logique qui les utilise.
- e2e (`e2e/*.spec.ts`) contre `vite dev`, avec des graines fixes (`?seed=E2E001`) pour des parcours déterministes.
