// i18next.config.mjs — Extraction & synchronisation des traductions (i18next-cli).
// npm run i18n:extract → scanne le code, aligne src/locales/{lang}/{ns}.json
// npm run i18n:sync    → propage la langue source vers les langues secondaires
//                        (clés manquantes ajoutées, clés mortes retirées,
//                         traductions existantes JAMAIS écrasées)

import { defineConfig } from 'i18next-cli';

export default defineConfig({
  // Ordre significatif : 'fr' = langue source. Les langues traduites s'ajoutent ici
  // (Phase 2 : 'en', Phase 3 : 'es', 'de', 'it', 'pt-BR').
  // secondaryLanguages est DÉRIVÉ de locales (toutes sauf primaryLanguage) —
  // ne pas le surcharger ici, sinon sync ne propagerait pas aux nouvelles langues.
  locales: ['fr', 'en', 'es', 'de', 'it', 'pt-BR'],
  extract: {
    input: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignore: ['**/*.d.ts', 'src/locales/**', 'src/types/**'],
    output: 'src/locales/{{language}}/{{namespace}}.json',
    primaryLanguage: 'fr',
    defaultNS: 'common',
    keySeparator: '.',
    nsSeparator: ':',
    sort: true,
    indentation: 2,
    removeUnusedKeys: true,
    // Clés résolues dynamiquement (i18next.t(variable)) — invisibles pour l'AST
    // de l'extracteur : preservées ici pour ne pas être purgées à chaque extract.
    // Arbres concernés : erreurs (codes → clés), occasions (labelKey), perf (crans),
    // suggestions catalogue (préfixe dynamique), verdicts communauté (préfixe adored/notConvinced),
    // hints de scan (FAILURE_HINT_KEYS) et messages de chargement (TEXT_KEYS[i] indexé).
    preservePatterns: ['errors.*', 'occasions.*', 'perf.*', 'empty.*', 'catalog.suggestions.*', 'verdictsCommunity.*', 'scan.hint*', 'scan.loading*'],
    extractFromComments: false,
    functions: ['t', '*.t', 'i18next.t'],
    transComponents: ['Trans'],
    useTranslationNames: ['useTranslation'],
  },
});
