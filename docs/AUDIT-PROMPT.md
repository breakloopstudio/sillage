# Prompt d'audit complet — Sillage

Prompt réutilisable pour lancer un audit de fond en comble du projet.
À copier-coller tel quel dans une nouvelle session. Fréquence recommandée : après chaque version majeure ou tous les mois.

---

## Le prompt

```
Lance un audit complet du projet (Sillage, React Native Expo + Supabase).
Tu es l'orchestrateur : lance 8 subagents explore en parallèle, puis synthétise
un rapport unique classé par sévérité (CRITIQUE / ÉLEVÉ / MOYEN / BAS / INFO).
Chaque constat doit citer fichier:ligne. Aucune modification de fichier.

Subagent 1 — Architecture & conventions :
Vérifie la conformité aux règles de .clinerules/rules.md et AGENTS.md :
aucun fichier-route utilitaire dans app/(tabs)/, pattern getStyles(t)+useMemo,
0 fontWeight, useCallback sur handlers passés aux enfants, try/catch sur appels
async, supabase.rpc jamais détaché, toNum() sur colonnes numeric, imports thème
(useTheme, jamais import direct). Liste les violations fichier:ligne.

Subagent 2 — Sécurité backend (SQL) :
Passe en revue supabase/migrations/ : chaque table a RLS + policy owner
(auth.uid()=user_id) ; chaque fonction SECURITY DEFINER vérifie la propriété
(pas d'IDOR via paramètres) ; paramètres lim plafonnés ; pas de fonction
definer exposée à anon sans garde ; grants cohérents ; CHECK/contraintes ;
updated_at triggers. Signale toute fonction recréée sans garde de sécurité.

Subagent 3 — Edge Functions (supabase/functions/) :
Pour chaque fonction : vérification d'auth (verifyUserToken/verifyCronAuth),
validation des inputs, injection de secrets uniquement via Deno.env,
gestion d'erreurs sans fuite, CORS, quota, idempotence des crons
(check-price-alerts, send-weather-notifications), endpoint share public
(données publiques uniquement, pas de fuite via createAdminClient).

Subagent 4 — Secrets & surface client :
.env bien gitignoré (y compris variantes .env.production) ; aucune clé
service_role/sk- dans src/, app/, scripts versionnés, google-services.json ;
EXPO_PUBLIC_* limités à url/anon ; JWT local dans src/config/env.ts acceptable ?
Vérifie aussi l'historique git : fichiers sensibles commités par le passé
(git log --diff-filter=A --name-only sur *.env, *.json de clés).

Subagent 5 — Qualité & tests :
npx tsc --noEmit (0 erreur attendu), npx jest --ci (725 tests), couverture
des zones critiques (utils/scan-match, voice-search, perf-fusion, services),
fichiers sans test associé, TODO/FIXME/HACK, console.log résiduels hors
console.warn services, dead code (exports jamais importés dans src/).

Subagent 6 — Performance :
FlatList virtualisées partout (pas de map() de listes longues), images
expo-image avec sizing, caches (LRU recherche, communauté 1h, météo 30min),
zéro setState dans boucles Reanimated (features/runner), projections étroites
(CARD_COLUMNS vs select('*')), useMemo/useCallback manquants sur chemins chauds
(CatalogPage, ParfumCard, DockBar).

Subagent 7 — Design system (.clinerules/design-guide.md) :
couleurs hardcodées hors exceptions §2.3, cibles tactiles <44px sans hitSlop,
allowFontScaling sur badges/chips, formatPrice vs toFixed, haptiques hors
mapping §2.6, plus d'une boucle infinie par écran, ombres dark mode (bordures),
un seul accent par écran.

Subagent 8 — Pipeline données & scripts :
scripts/fragrantica + scripts/images : idempotence, resumable, gestion
d'erreurs, pas de credentials en dur, .env.example synchronisé avec les
variables réellement lues, cohérence migrations 0001→0059 (numéro manquant ?),
supabase/config.toml sans secrets en dur.

Rapport final : docs/audit-YYYY-MM-DD.md, avec :
1) résumé exécutif 5 lignes
2) tableau des constats par sévérité
3) top 10 actions recommandées effort/impact
4) comparaison avec l'audit précédent s'il existe dans docs/
```

---

## Notes d'utilisation

- Le subagent 5 exécute des commandes (`tsc`, `jest`) : utiliser un subagent `general`, les 7 autres en `explore`.
- Après l'audit, lancer 2-3 subagents reviewer pour challenger les constats (faux positifs, sévérité sur/sous-estimée) avant de figer le rapport.
- Conserver chaque rapport daté dans `docs/` pour le diff d'un audit à l'autre (section 4 du prompt).
