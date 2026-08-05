# Runbook i18n — Sillage

> **Mission** : garder les traductions alignées et de qualité dans le temps, à chaque
> feature ajoutée, à chaque évolution du catalogue, à chaque nouvelle langue.
> La traduction n'est jamais « finie » : c'est un processus continu. Ce document est la
> référence opérationnelle. Les règles de code i18n vivent dans `.clinerules/rules.md` §23 ;
> la voix éditoriale dans `.clinerules/design-guide.md` §3.6.

**État d'avancement** : Phase 0 infra ✅ · Phase 1 extraction ✅ · Phase 2 EN ✅ ·
Phase 3 ES/DE/IT/PT-BR ✅ · Phase 4 catalogue (à faire) · Phase 5 devises (à faire).

---

## 0. Modèle mental (60 secondes)

- **FR = langue source.** `src/locales/fr/common.json` fait foi. Le code est écrit en FR.
- **Une langue = un fichier** `src/locales/{lang}/common.json`. Actuellement : `fr`, `en`.
- **Infra** : `src/i18n/` (`config.ts`, `options.ts`, `resources.ts`, `index.ts`) ·
  tooling `i18next-cli` (`npm run i18n:extract` / `i18n:sync` / `i18n:check`).
- **Clés typées** : `src/types/i18next.d.ts` indexe `resources['fr']` → une clé fausse =
  erreur `tsc`. Les clés sont **namespacées par domaine** (`scan.*`, `detail.*`, `settings.*`).
- **Ce qui est traduit ici** : les chaînes UI uniquement. Les données catalogue
  (notes, accords, familles, descriptions des ~25 100 parfums) ne sont **pas** dans
  `common.json` — elles vivent en base et seront traduites en **Phase 4** (Supabase Storage).

### Les 4 commandes

| Commande | Effet |
|---|---|
| `npm run i18n:extract` | Scanne le code, aligne `fr/common.json` (ajoute manquantes, retire mortes, trie). **Idempotent.** |
| `npm run i18n:sync` | Propage la source FR → langues secondaires (clés manquantes ajoutées, traductions existantes **jamais** écrasées). |
| `npm run i18n:check` | Contrôle de parité (clés vides/manquantes/en trop, interpolations, valeur=clé). **Exit 1 si défaut** — à passer avant commit / en CI. |
| `npx tsc --noEmit` | 0 erreur attendu (clés typées). |

---

## 1. Scénario : j'ajoute / je modifie des chaînes UI (feature, écran, composant)

**C'est le cas le plus fréquent.** Dès qu'un texte user-facing apparaît ou change :

1. **Coder avec `t()` / `i18next.t()`** — jamais de FR inline dans le nouveau code
   (rules.md §23). Ajouter la clé dans `fr/common.json` en même temps, ou laisser
   `extract` l'aligner à l'étape suivante.
2. **`npm run i18n:extract`** — aligne la source FR depuis le code.
3. **`npm run i18n:sync`** — propage le delta FR → `en` (et toute langue secondaire).
   Les nouvelles clés apparaissent dans les langues secondaires **à traduire**.
4. **Traduire le delta** dans chaque langue secondaire (voir §5 glossaire + §6 règles).
   Relire à voix haute : ça doit sonner naturel, pas « traduit ».
5. **Vérifier** :
   ```bash
   npm run i18n:check     # parité clés + interpolations + valeurs vides
   npx tsc --noEmit       # clés typées
   npx jest --ci          # régressions (jest tourne en fr)
   npm run i18n:extract   # doit rester idempotent (hash stable sur 2 runs)
   ```

### Cas particulier — clés dynamiques (`t(variable)`)
Les clés résolues dynamiquement (codes d'erreur, crans, labelKeys…) sont **invisibles**
pour l'AST de l'extracteur. Leur famille doit être protégée par `preservePatterns` dans
`i18next.config.mjs` (déjà : `errors.*`, `occasions.*`, `perf.*`, `empty.*`,
`catalog.suggestions.*`, `verdictsCommunity.*`, `scan.hint*`, `scan.loading*`), et les clés
ajoutées **à la main** dans `fr/common.json` — sinon `extract` les purge.

---

## 2. Scénario : j'ajoute de nouveaux parfums (données catalogue)

**Bonne nouvelle : rien à retraduire côté UI.**

- Nom, marque, notes, accords, famille, description d'un parfum sont des **données** en base
  (table `parfums`), pas des chaînes de `common.json`. Le pipeline d'import
  (`npm run import-fresh`, etc.) n'impacte donc **pas** l'i18n UI.
- Les libellés UI qui les affichent (« Parfum », « Ajouter », « Pyramide olfactive »…) sont
  **déjà traduits** une fois pour toutes.
- La traduction du **contenu** catalogue (notes, descriptions…) = **Phase 4** :
  Supabase Storage + cache disque + colonne `language` (pour push & share SSR). Hors périmètre
  de ce runbook tant que la Phase 4 n'est pas lancée.

**Exception** : si un nouveau parfum introduit un **concept UI nouveau** (un nouveau statut,
un nouveau type de possession…), c'est en réalité une nouvelle chaîne UI → revenir au §1.

---

## 3. Scénario : j'ajoute une nouvelle langue (Phase 3)

Checklist complète (exemple avec `es`). **Ordre important** : le fichier JSON doit exister
avant d'être importé dans `resources.ts` (sinon `tsc` échoue).

1. **`src/i18n/config.ts`** : ajouter `'es'` à `SUPPORTED_LANGUAGES` + entrée
   `{ code: 'es', nativeLabel: 'Español' }` dans `AVAILABLE_LANGUAGES`.
2. **`i18next.config.mjs`** : ajouter `'es'` à `locales` (`secondaryLanguages` est **dérivé
   automatiquement** — ne pas le surcharger).
3. **`npm run i18n:sync`** → génère `src/locales/es/common.json` (clés à plat, valeurs vides).
4. **Traduire** (glossaire §5 + règles §6 + relecture humaine). Adapter les **pluriels aux
   règles CLDR** de la langue (voir §6).
5. **`src/i18n/resources.ts`** : `import esCommon from '../locales/es/common.json'` +
   `es: { common: esCommon }` dans `resources`. **Oublier cet import = fallback silencieux**
   (la langue est acceptée mais retombe sur FR/EN sans avertissement).
6. **`app.json`** : ajouter `expo.locales.es` (chaînes de permissions iOS localisées) +
   mettre à jour `expo-localization.supportedLocales` (`ios` + `android`).
7. **Vérifier** : `npm run i18n:check` + `npx tsc --noEmit` + `npx jest --ci` +
   `npm run i18n:extract` (idempotent).
8. **Relire** : glossaire cohérent, ton « expert chaleureux » adapté à la langue (le
   tutoiement FR n'existe pas partout — choisir le registre naturel).

> Quand une nouvelle langue est complète, reconsidérer `UNSUPPORTED_FALLBACK_LANGUAGE`
> (actuellement `'en'`, le repli le plus universel) et la chaîne `fallbackLng` dans
> `options.ts` (actuellement `['en', 'fr']`).

---

## 4. Scénario : je modifie le code sans toucher aux chaînes (refactor, fix)

Rien à faire pour l'i18n **sauf** si une clé est renommée/déplacée dans le code :
dans ce cas, relancer `npm run i18n:extract` (réaligne la source) puis `i18n:sync`
(propage aux langues secondaires) et vérifier avec `i18n:check`.

---

## 5. Glossaire terminologique (table vivante)

Cohérence obligatoire : le même concept FR se traduit **toujours** pareil. S'enrichit à
chaque langue. Néologismes/emprunts assumés (ex. *sillage*, *Flacon Runner*) restent tels quels.

| FR | EN | ES | DE | IT | PT-BR | Notes |
|---|---|---|---|---|---|---|
| Ma Parfumerie / Parfumerie | My Perfumery / Perfumery | Mi perfumería / Perfumería | Meine Parfümerie / Parfümerie | La mia profumeria / Profumeria | Minha perfumaria / Perfumaria | section brandée |
| étagère | shelf | estante | Regal | scaffale | prateleira | |
| flacon | bottle | frasco | Flakon | flacone | frasco | |
| maison | house | casa | Haus | maison | casa | « maison de parfum » |
| marque | brand | marca | Marke | marca | marca | distinct de *maison* |
| nez | nose | nariz | Nase | naso | nariz | le parfumeur |
| sillage | sillage | estela | Sillage | scia | rastro | terme parfumerie |
| parfum du jour (SOTD) | scent of the day | perfume del día | Duft des Tages | profumo del giorno | perfume do dia | |
| À sentir / Je l'ai / Fini | To try / I have it / Finished | Por probar / Lo tengo / Terminado | Zum Testen / Ich habe ihn / Aufgebraucht | Da provare / Ce l'ho / Finito | Para experimentar / Eu tenho / Acabou | statuts |
| Senti / Je l'ai eu | Tried / I had it | Probado / Lo tuve | Getestet / Ich hatte ihn | Testato / Ce l'avevo | Testado / Eu tinha | statuts |
| Coup de cœur (verdict) | Love it | Me encanta | Ich liebe es | Lo adoro | Amei | verdict *love* |
| J'aime / Mitigé / Pas pour moi | Like it / Mixed / Not for me | Me gusta / Regular / No es para mí | Ich mag es / Durchwachsen / Nicht meins | Mi piace / Non mi convince / Non fa per me | Gostei / Mais ou menos / Não é para mim | verdicts |
| Coup de cœur (favori) | favorite | favorito | Favorit | preferito | favorito | le cœur ❤️ |
| Tenue / Longévité | Longevity | Duración | Haltbarkeit / Longevität | Tenuta / Longevità | Fixação | |
| hespéridée | Citrus | Cítrica | Zitrisch | Agrumata | Cítrica | famille olfactive |
| Ambrée / Boisée / Florale / Gourmande / Aromatique | Amber / Woody / Floral / Gourmand / Aromatic | Ambarada / Amaderada / Floral / Gourmand / Aromática | Ambra / Holzig / Blumig / Gourmand / Aromatisch | Ambrata / Legnosa / Floreale / Gourmand / Aromatica | Ambarada / Amadeirada / Floral / Gourmand / Aromática | familles |
| Automne | Autumn | Otoño | Herbst | Autunno | Outono | choix : pas *Fall* |
| Voir la fiche | View details | Ver detalles | Details ansehen | Vedi dettagli | Ver detalhes | la fiche détail |
| Voir l'offre | View offer | Ver oferta | Zum Angebot | Vedi offerta | Ver oferta | lien affilié |
| geste | gesture | gesto | Geste | gesto | gesto | défi quotidien/hebdo |
| pseudo | username | nombre de usuario | Nutzername | nome utente | nome de usuário | |
| carnet d'essais | trial notebook | cuaderno de pruebas | Test-Notizbuch | taccuino di prova | caderno de testes | |
| Flacon Runner | Flacon Runner | Flacon Runner | Flacon Runner | Flacon Runner | Flacon Runner | nom du mini-jeu, conservé |

---

## 6. Règles de traduction

1. **Ne PAS traduire** : noms de marques et de parfums (orthographe officielle), données
   catalogue (Phase 4), mots-clés de matching, emprunts assumés (*sillage*, *Flacon Runner*).
2. **Pluriels** : garder la structure `_one` / `_many` / `_other` et l'adapter aux règles
   CLDR de la langue cible. **EN** : `_one` singulier, `_other` pluriel, `_many` = `_other`
   (la catégorie *many* n'existe pas en anglais pour les cardinaux, mais la clé doit exister
   et mirrorer `_other` — sinon `i18n:sync` réinjectera la valeur FR pour combler le trou).
3. **Interpolations** : préserver **exactement** `{{count}}`, `{{label}}`, `{{price}}`,
   `{{marque}}`, `{{nom}}`, etc. `i18n:check` contrôle automatiquement.
4. **Ton** : « expert chaleureux » (design-guide §3.6) — phrase case, **pas de « ! »**, pas de
   ton promotionnel, tutoiement FR → registre naturel de la langue cible.
5. **Formatage** : ne jamais coder en dur prix / pourcentages / dates — les helpers
   (`formatPrice`, `formatNumber`, `Intl`) suivent déjà la locale. Rien à traduire là.
6. **Fragments concaténés** (ex. `community.timeline.*`, préfixes `scan.readPrefix`) :
   préserver **exactement** les espaces leading/trailing — ils sont assemblés au runtime.
7. **Typographie** : ne pas calquer la ponctuation FR (espaces insécables, `·`, `–`) sur les
   autres langues — le formatage passe par `Intl`. Les séparateurs visuels (`·`, `–`, `…`)
   restent pertinents là où ils structurent l'UI.

---

## 7. Vérifications & pièges connus

### Vérifications avant commit
```bash
npm run i18n:check      # parité + valeurs vides + interpolations + valeur=clé
npx tsc --noEmit        # 0 erreur (clés typées)
npx jest --ci           # 917 tests / 80 suites (jest-setup initialise en fr)
npm run i18n:extract    # idempotent : hash common.json stable sur 2 runs
```

### Pièges (rencontrés lors de la Phase 2)
- **`sync`/`extract` réalignent depuis le code du working tree.** Si des changements de code
  non commités ajoutent des clés (ex. nouvel écran), `sync` les injecte dans FR **et** il faut
  ensuite les propager/traduire dans les langues secondaires. Toujours finir par
  `npm run i18n:check` pour détecter une parité cassée (épisodes vécus : `catalog.exploreTitle`,
  `searchChrome.openWheelA11y`, `scan.stagingAnalyze_many`).
- **Valeur = chemin de clé** (ex. `"runner.dailyCombo": "runner.dailyCombo"`) : défaut
  d'extraction à corriger — la clé s'afficherait crue. `i18n:check` le détecte (`VALEUR=CLÉ`).
- **Import oublié dans `resources.ts`** : la langue est acceptée mais tombe en **fallback
  silencieux**. Vérifier que chaque langue de `SUPPORTED_LANGUAGES` a son bloc dans `resources`.
- **`t()` au scope module interdit** : s'exécute avant l'init i18next et renvoie la clé crue.
  Les tables de labels au scope module utilisent des **getters** résolus au render.
- **Clés dynamiques** : invisibles pour l'extracteur → `preservePatterns` + ajout manuel (voir §1).
- **Pluriel `_many` manquant** : même inutilisé en EN, il doit exister et mirrorer `_other`,
  sinon `sync` le recrée avec la valeur FR.

---

## 8. Prompt prêt-à-coller — traduire le delta FR → {langue}

À copier dans une session fraîche après un `i18n:sync` qui a ajouté des clés à traduire.

```
Traduis le delta de src/locales/fr/common.json vers src/locales/{lang}/common.json.
Contexte : projet Sillage (React Native/Expo, scanner de parfums). FR = langue source.
1. Identifie les clés de {lang}/common.json vides ou égales à la valeur FR (ce sont les
   chaînes à traduire) : `npm run i18n:check -- --verbose`.
2. Traduis-les en respectant : le glossaire de docs/i18n-runbook.md §5, les règles §6
   (pluriels CLDR, interpolations {{…}} préservées, ton « expert chaleureux », pas de « ! »,
   ce qu'on ne traduit pas), et la voix éditoriale de .clinerules/design-guide.md §3.6.
3. Fragments concaténés (community.timeline.*, scan.readPrefix…) : garde les espaces
   leading/trailing exacts.
4. Vérifie : npm run i18n:check && npx tsc --noEmit && npx jest --ci && npm run i18n:extract.
Ne modifie QUE src/locales/{lang}/common.json. Rends un résumé des choix de traduction.
```

---

## Changelog
- **Phase 3** (août 2026) : traduction ES, DE, IT, PT-BR (1 230 clés chacune, parité 100 %).
  Variante régionale `pt-BR` : `resolveInitialLanguage` gère désormais les balises régionales
  (locale `pt`/`pt-PT` → `pt-BR`). Glossaire enrichi en 6 langues.
- **Phase 2** (août 2026) : création du runbook + script `i18n:check` (parité automatisée).
  Traduction EN complète, fallback `UNSUPPORTED_FALLBACK_LANGUAGE` → `en`.
