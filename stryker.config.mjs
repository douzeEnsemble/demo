/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: "npm",
  // Comme dans KoiKiManke/OnMangeQuoi : le runner "vitest" dédié
  // n'exécute quasiment aucun test par mutant (heuristique « --related »
  // mal résolue dans le bac à sable de Stryker), d'où un score sans
  // signification. Le runner "command" (une commande `vitest run` fixe
  // relancée pour chaque mutant) donne un score fiable.
  testRunner: "command",
  commandRunner: {
    // Uniquement les fichiers de test qui couvrent le périmètre muté
    // ci-dessous (`mutate`), pas `npm test` en entier : les tests des vues
    // (jsdom, ~1 s de démarrage chacun) ne peuvent de toute façon pas tuer
    // un mutant placé dans un générateur mieux que son propre test. Liste
    // figée à la main pour rester synchronisée avec `mutate` : ajouter un
    // générateur sans ajouter son test ici ferait survivre tous ses mutants.
    command:
      "npx vitest run src/lib/random.test.ts src/lib/seed.test.ts src/lib/fake.test.ts src/lib/format.test.ts src/apps/wheel/generator.test.ts src/apps/poll/generator.test.ts src/apps/stock/generator.test.ts src/apps/booking/generator.test.ts",
  },
  coverageAnalysis: "off",
  // Le préprocesseur de tsconfig de Stryker appelle une API TypeScript
  // retirée de TypeScript 7 (`ts.parseConfigFileTextToJson`) et plante au
  // démarrage. Le pointer vers un fichier inexistant le rend inopérant —
  // sans conséquence, le runner "command" n'a pas besoin de la passe de
  // typage de Stryker.
  tsconfigFile: "tsconfig.stryker-unused.json",
  reporters: ["clear-text", "progress", "html"],
  htmlReporter: {
    fileName: "mutation-report/index.html",
  },
  // Périmètre volontairement plus restreint que la couverture 100 % de
  // vitest.config.ts (qui couvre aussi les vues DOM) : la logique pure,
  // c'est-à-dire tout ce qui fabrique ou transforme les données fictives.
  mutate: [
    "src/lib/random.ts",
    "src/lib/seed.ts",
    "src/lib/fake.ts",
    "src/lib/format.ts",
    "src/apps/*/generator.ts",
  ],
  ignorePatterns: ["dist", "coverage", "mutation-report", "playwright-report", "test-results", ".wrangler"],
  thresholds: {
    high: 95,
    low: 85,
    break: 80,
  },
  tempDirName: ".stryker-tmp",
  cleanTempDir: true,
};
