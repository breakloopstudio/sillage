# Guide de design — Sillage

**Direction** : « Luxe malin »  
**Version** : 1.5 — Juillet 2026 (accessibilité profonde, sheets unifiés, formatage données, motion signature, densité, haptique, adaptive)  
**Cible** : iOS + Android (React Native 0.86 / Expo SDK 57)

---

## 0. Quick reference — les 10 règles qui couvrent 90 % des cas

1. Couleurs : `t.colors.*` via `useTheme()`, jamais d'hex en dur (exceptions §2.3). Paire soft/ink obligatoire sur fond teinté (§2.2).
2. Typo : `fontFamily` uniquement, jamais `fontWeight` ; toute `fontFamily` existe dans le `useFonts` de `app/_layout.tsx`.
3. Styles : `getStyles(t)` + `useMemo` ; `StyleSheet.create` réservé au statique pur.
4. Transparences : paliers §2.5 via `alpha()`, dark lumineux ÷2, structure inchangé.
5. Touch : cibles ≥ 44 px ou `hitSlop` explicite.
6. Motion : 1 boucle infinie max/écran (inventaire §7.5) ; Reduced Motion respecté (§6.7).
7. Haptique : mapping §2.6 — light = sélection, success = achèvement, error = destructif.
8. Données : `formatPrice()` pour tout montant, jamais `toFixed` (§3.7).
9. Un seul accent par écran (primary OU secondary) ; italique éditorial ≤ 2 lignes, non adjacentes (§3.2).
10. Accessibilité : badges/chips `allowFontScaling={false}`, textes longs `maxFontSizeMultiplier={1.3}`, dataviz vocalisée (§6.8).

---

## 1. Principes fondateurs

1. **Le luxe du savoir, pas du prix** — L'interface doit inspirer confiance et expertise, sans ostentation. Chaque élément visuel sert l'information, pas la décoration.

2. **Contraste par la couleur, pas par la taille** — Trois couleurs sémantiques (teal, doré, violet) portent le sens. La hiérarchie visuelle vient du jeu entre fonds atténués (soft) et accents saturés — jamais de tailles de police extrêmes.

3. **Mobile-first, pouce-first** — Toute l'interface est conçue pour une main, un pouce. Les actions critiques sont dans la moitié inférieure de l'écran. Les cibles tactiles font 44 px minimum, vérifiées avec `hitSlop` explicite si nécessaire.

4. **Réduction délibérée** — Une seule police display (Playfair), une seule police body (Inter). Un seul accent visible par écran (primaire OU secondaire, pas les deux). Les ombres sont légères, les bordures fines.

5. **Fluidité discrète** — Les animations sont fonctionnelles : feedback d'appui, transition d'état, célébration d'un résultat. Spring pour les gestes, timing pour les entrées. Rien ne distrait.

6. **Accessible par défaut** — L'app fonctionne avec le texte agrandi (`maxFontSizeMultiplier`), les cibles tactiles ≥ 44 px, les contrastes WCAG AA. Voir §6.6.

---

## 2. Règles d'usage des couleurs

### 2.1 Token → Contexte

| Token | Utilisation |
|---|---|
| `background` | Fond de page / écran entier. Jamais utilisé comme fond de carte. |
| `surface` | Fond de carte, liste, conteneur surélevé. |
| `surface2` | Fond secondaire : arrière-plan de chip inactif, séparateur de section, fond de rangée alternative. |
| `border` | Bordures : séparateurs de liste, divider, contour de carte si pas d'ombre. `StyleSheet.hairlineWidth` par défaut. |
| `text` | Texte principal : titre, corps, label actif. |
| `textMuted` | Texte secondaire : sous-titre, métadonnée, placeholder, caption. |
| `textInverse` | Texte sur fond sombre (light) / fond clair (dark). En pratique, utiliser `#FFFFFF` en dur sur les boutons colorés et overlays — cette valeur est invariante et ne dépend pas du thème. Le token `textInverse` lui-même varie (`#FFFFFF` light / `#0B0712` dark) et sert aux textes sur surfaces inversées. |
| `primary` | Bouton principal, icône active, texte d'action, indicateur sélectionné. |
| `primarySoft` | Fond d'icône, fond de chip actif (famille olfactive), fond d'état vide, hover/pressé sur ghost. |
| `primaryInk` | Texte sur fond `primarySoft` (chips, pastilles, labels). Plus foncé que `primary` en light, plus clair en dark. |
| `secondary` | **Jamais en UI fonctionnelle.** Réservé aux accents décoratifs : récompense, badge promo, indicateur année. |
| `secondarySoft` | Fond de badge secondaire (année), fond d'étiquette note de cœur. |
| `deal` | Prix bonne affaire (ratio < 0.8), badge économie, indicateur tendance baissière. |
| `dealSoft` | Fond de zone prix deal, fond de carte promo. |
| `overpriced` | Prix surévalué (ratio > 1.05), alerte. |
| `overpricedSoft` | Fond de zone prix surévalué. |
| `fair` | Prix correct (ratio 0.8–1.05). |
| `fairSoft` | Fond de zone prix correct. |
| `favorite` | Icône cœur actif (favori). Identique à `overpriced` en valeur (même rouge), sémantique différente. |
| `favoriteSoft` | Fond cœur (alerte favori). |
| `pyramidTop` | Note de tête — cercle pyramide, pastille de note, texte de chip. |
| `pyramidTopSoft` | Fond de la zone notes de tête. |
| `pyramidHeart` | Note de cœur — cercle pyramide, pastille de note. |
| `pyramidHeartSoft` | Fond de la zone notes de cœur. |
| `pyramidBase` | Note de fond — cercle pyramide, pastille de note. |
| `pyramidBaseSoft` | Fond de la zone notes de fond. |
| `seasonSpring` / `seasonSummer` / `seasonFall` / `seasonWinter` | Identité chromatique des saisons — remplissage des barres de saison et icônes actives (fiche détail, « Quand le porter »). Ne jamais substituer `deal`/`fair`/`secondary` à ces usages. |
| `seasonSpringSoft` → `seasonWinterSoft` | Pastille de la meilleure saison (fond atténué). |
| `reward` / `rewardSoft` | Badge promo (-X%), fond de badge. Identique à `secondary`/`secondarySoft`. |
| `perf` / `perfSoft` / `perfInk` | Teinte **dataviz** de la performance olfactive (section « Tenue & sillage » : pastille, crans, bouton de vote). Acier froid, délibérément hors du conflit d'accent chaud violet/doré — **ne pas la remplacer par `reward`/`secondary`** (cela réintroduirait un 2ᵉ accent chaud, §2.4). |
| `accord0` → `accord7` | Palette 8 couleurs des accords olfactifs (AccordProfile, §4.12). Chaque accord est mappé à un index via `accordColorIndex()`. Utilisés en fond de barre + texte `accordNInk`. |
| `danger` | État d'erreur, bouton destructif. |
| `success` | État de succès, confirmation. |
| `warning` | État d'avertissement, attention. |

### 2.2 Règle des soft/ink

Chaque couleur sémantique (primary, secondary/deal/reward, pyramidTop/Heart/Base, overpriced, fair) a **trois déclinaisons** :

```
couleur     → fond, icône, bordure active, texte de chip sur fond blanc
couleurSoft → fond atténué (arrière-plan de badge, zone colorée)
couleurInk  → texte sur fond soft (lisible, plus foncé en light, plus clair en dark)
```

**Pattern standard** :
```tsx
<View style={{ backgroundColor: t.colors.primarySoft }}>
  <Text style={{ color: t.colors.primaryInk }}>Label</Text>
</View>
```

### 2.3 Couleurs invariantes

Certaines couleurs ne changent jamais entre light et dark mode. Elles peuvent être utilisées en dur :

| Valeur | Contexte | Justification |
|---|---|---|
| `#FFFFFF` | Texte sur bouton coloré, icône FAB, texte sur chip note | Blanc pur — même rendu dans les deux thèmes |
| `#1F1A2E` | Texte sur badge doré (`secondary`/`reward`) | Contraste optimal sur doré, inchangé entre thèmes |
| `rgba(0,0,0,0.4)` | Overlay de fond (ActionSheet, modale) | Overlay semi-transparent indépendant du thème |
| `rgba(11,7,18,0.96)` | Fond lightbox (`ImageViewerPopup`) | `#0B0712` (violet-noir on-brand) — sombre dans les deux thèmes, ne doit jamais varier (§8.4 : pas de noir pur) |
| `rgba(255,255,255,0.12)` | Fond du bouton close sur lightbox | Verre dépoli sur fond sombre, invariant — bouton non intrusif, lisible dans les deux thèmes |
| `rgba(255,255,255,0.22)` | Bordure du bouton close sur lightbox | Même logique verre dépoli, hairlineWidth |
| `rgba(237,232,245,0.75)` | Texte secondaire sur lightbox (brand) | `text` dark `#EDE8F5` atténué à 75 %, lisible sur `#0B0712` dans les deux thèmes |
| `rgba(255,255,255,0.32→0)` | Rim light + éclaircissement du FAB obturateur (arc supérieur) | Reflet de tranche physique, blanc quel que soit le thème — donne du volume au FAB (DockBar §4.11) |
| `rgba(0,0,0,0.24→0.30)` | Ombrage du FAB obturateur (base + disque intérieur creux) | Ombre physique, noire quel que soit le thème — creuse le FAB et la lentille (DockBar §4.11) |

Toute autre couleur hardcodée est une violation. Utiliser `t.colors.*`.

### 2.4 Pièges à éviter

- ❌ `primary` ET `secondary` sur le même écran (hors pyramide)
- ❌ Texte body en `primary` — réservé aux actions
- ❌ Fond `background` sur une carte — utiliser `surface`
- ❌ `textMuted` sur fond `primarySoft` — utiliser `primaryInk`
- ❌ `favorite` pour autre chose que le cœur favori
- ❌ Du violet et du doré côte à côte comme couleurs d'action

### 2.5 Échelle d'opacité sémantique

Toute transparence appliquée à une couleur du thème (via `alpha()`, `stopOpacity` ou `opacity`) utilise un palier de l'échelle — jamais de valeur arbitraire.

| Palier | Light | Dark (effets lumineux) | Usage |
|---|---|---|---|
| `ghost` | 8 % | 4 % | Textures subliminales (gravure §4.12), motifs |
| `hint` | 16 % | 8 % | Voiles légers, hairlines colorées, lueurs d'ambiance |
| `veil` | 24 % | 12 % | Halos de strate, bordures de pétale, bordures teintées de popup |
| `dim` | 40 % | 25 % | Couche inactive, contenu estompé au profit d'un actif |
| `scrim` | `rgba(0,0,0,0.4)` invariant (§2.3) | idem | Backdrops (popup, sheet, lightbox) |

Règles :

- **Effets lumineux** (halo, voile, glow — lumière projetée sur le fond) : en dark mode, le palier est **divisé par deux**. Une lumière claire sur fond sombre paraît deux fois plus intense ; sans cette division, un halo devient un disque visible. C'est la règle qui gouverne §4.14.
- **Éléments structurels** (bordures, hairlines, séparateurs) : même palier dans les deux thèmes ; si illisible en dark, monter d'un cran — jamais descendre.
- **Tolérance ±4 points** pour les valeurs existantes déjà calées visuellement : elles sont grand-père ; les aligner au palier le plus proche lors de la prochaine retouche du composant.
- **Effets composites** (gradient × opacité d'élément animée) : le palier s'apprécie sur l'opacité effective résultante à l'état stable.
- Helper obligatoire : `alpha(hex, palier)` — pas de `rgba()` manuel hors §2.3. Cible : `src/utils/alpha.ts` avec paliers nommés + division dark automatique ; état actuel : helper brut `alpha(hex, ratio)` dans `src/features/catalog/pyramid/geometry.ts` (sans paliers ni règle dark) — migration = chantier code ; en attendant, appliquer les paliers à la main.

### 2.6 Langage haptique

Trois intensités, trois sens — jamais d'haptique hors de ce mapping :

| Fonction | Sens | Exemples |
|---|---|---|
| `hapticsLight()` | **Sélection** | changement d'onglet, chip, segment, toggle, lettre du BrandSheet |
| `hapticsSuccess()` | **Achèvement** | ajout favori/parfumerie/carnet, SOTD choisi, scan identifié |
| `hapticsError()` | **Destructif / échec** | suppression, échec scan, action impossible |

Règles :
- 1 haptique max par geste ; jamais sur scroll, drag continu, ou événement automatique — que du user-initié
- Le FAB Scan n'a pas d'haptique à l'ouverture caméra — réservé à la capture
- `expo-haptics` respecte le mode silencieux natif — ne pas ajouter de garde manuelle

---

## 3. Règles typographiques

### 3.1 Police — règle `fontFamily` obligatoire

Inter et Playfair Display sont chargées via `expo-font` en **fichiers séparés par poids** (`Inter_400Regular.ttf`, `Inter_600SemiBold.ttf`, etc.). React Native ne résout **pas** `fontWeight: '600'` vers le bon fichier de police custom — il applique un faux gras algorithmique sur le fichier Regular, produisant un rendu incorrect.

**Règle : toujours `fontFamily`. Jamais `fontWeight`.**

```tsx
// ✅ Correct
fontFamily: 'Inter_600SemiBold'

// ❌ Interdit — rendu incorrect sur police custom
fontWeight: '600'
```

### 3.2 Mapping police × usage

| Rôle | Police | Taille | Exemple |
|---|---|---|---|
| Titre de page (h1) | `PlayfairDisplay_700Bold` | 28–34 | "Cadre le flacon" |
| Ligne éditoriale | `PlayfairDisplay_700Bold_Italic` | 15 | Accroche contextuelle en voix lookbook — fiche détail (« Hiver · Soirée »). **Italique réservé aux lignes éditoriales** : max 2 par écran, de voix distinctes (factuelle « Hiver · Soirée » vs aphoristique « L'éclat, le cœur, puis la trace »), jamais adjacentes (au moins une section d'écart), jamais pour un titre, un label ou du corps. |
| Label signature | `PlayfairDisplay_600SemiBold` | 15–16 | Nom d'une strate interactive (« Tête », « Cœur », « Fond ») sur une planche annotée (§4.12). Unique usage de Playfair hors titres : jamais sur du corps, un seul type d'élément interactif par section peut l'utiliser. |
| Titre de section (h2) | `PlayfairDisplay_600SemiBold` | 18–20 | "Ta collection", "Pyramide olfactive" |
| Titre de carte (h3) | `PlayfairDisplay_600SemiBold` | 18 | Nom du parfum |
| Marque (overline) | `Inter_400Regular` | 10–12 | Texte uppercase + `letterSpacing: 1–1.5` |
| Corps (body) | `Inter_400Regular` | 14–15 | Texte courant, descriptions |
| Corps emphatique | `Inter_500Medium` | 14 | Sous-titres, labels de champ |
| UI label | `Inter_600SemiBold` | 14–16 | Labels de bouton, onglets, titres de liste |
| Prix (hero fiche) | `Inter_700Bold` | 32–42 | Prix principal fiche détail |
| Prix (barre d'action) | `Inter_800ExtraBold` | 20 | Barre flottante §4.11 |
| Prix (carte) | `Inter_800ExtraBold` | 15–16 | ParfumCard comfortable / list |
| Prix (carousel) | `Inter_700Bold` | 13–14 | ParfumCard carousel / compactPlus |
| Badge / chip | `Inter_500Medium` | 11–13 | Famille olfactive, année, notes |
| Caption | `Inter_400Regular` | 11–13 | Texte d'aide, info secondaire |
| Placeholder | `Inter_400Regular` | 12 | "Rechercher un parfum..." |
| Compteur | `Inter_700Bold` | 11 | Nombre de notes dans pyramide |

### 3.3 Hiérarchie par page

**Scan idle** : Playfair 28 → Inter 15 → Inter 17 (CTA) → Inter 12 (tip)  
**Fiche détail** : Playfair 28 (nom) → Inter 14 (marque uppercase) → Inter 32 (prix) → Playfair 18 (sections) → Inter 14 (corps)  
**Profil** : Playfair 24 (prénom) → Inter 14 (email) → Playfair 18 (onglets) → Inter 13 (liste)  
**Catalogue** : Playfair 18 (nom carte) → Inter 12 (marque) → Inter 11 (chips) → Inter 14 (prix deal)

### 3.4 Letter spacing

- Marque (overline) : `letterSpacing: 1.5` (12px) ou `1` (10px carousel)
- Étiquette "Tête/Cœur/Fond" : `letterSpacing: 1` — sauf en label signature (§3.2) où Playfair se passe de letterSpacing
- Aucun autre letterSpacing dans l'app

### 3.5 Chiffres tabulaires

`fontVariant: ['tabular-nums']` (Inter) obligatoire sur toute donnée chiffrée alignée ou juxtaposée : prix (existant) et **fenêtres temporelles** (« 0 – 15 min », « 15 min – 2 h »). Évite le jitter des chiffres proportionnels dans les annotations et les comparateurs. Ne jamais appliquer sur Playfair (ses chiffres elzeviriens sont voulus).

### 3.6 Copy — voix éditoriale

La voix « Luxe malin » est celle d'un expert chaleureux : précis, sensoriel, jamais commercial.

**Registre**

- Tutoiement systématique.
- Phrase case (majuscule à la première lettre uniquement) — jamais de Title Case.
- Boutons à l'infinitif (« Scanner un flacon »), titres de section nominaux (« Comparer les marchands »).
- Jamais de point d'exclamation. Jamais de ton promotionnel dans le copy courant (« promo », « pas cher », « offre exceptionnelle ») — le badge -X % parle de lui-même.

**Ponctuation maison**

- Plages et durées : tiret cadratin `–` (U+2013) — « 0 – 15 min ».
- Énumérations inline : séparateur `·` — « Hiver · Soirée ».
- Suspension : caractère unique `…`, jamais trois points.
- Deux-points : espace insécable avant (« Perceptible : 15 min – 2 h »).

**Lignes éditoriales (§3.2)**

- Maximum 6 mots. Métaphore **sensorielle** obligatoire : tactile (« La peau s'en souvient »), lumineuse (« L'éclat des premières minutes »), temporelle (« Le parfum, heure par heure »).
- Métaphores interdites : mécaniques, sportives, scatologiques ou corporelles ambiguës, et tout ce qui évoque une tâche ou une saleté (« trace »).
- Vocabulaire privilégié : sillage, empreinte, cœur, éclat, tenue, flacon, accord, note, peau.
- Vocabulaire interdit dans le copy utilisateur : produit, item, article, référence, SKU, trace, tâche.

**États vides & erreurs**

- Factuel puis bienveillant : constat d'abord, action ensuite (« Aucune note de cœur renseignée », jamais « Pas de notes :( »).
- Jamais d'émoticônes dans les messages système.

**Internationalisation (i18n, rules.md §23)**

- Ces règles de copy gouvernent la langue source FR. Chaque langue cible a ses propres conventions (ponctuation, tutoiement/vouvoiement, longueur) définies dans le glossaire de traduction — ne pas calquer la typographie FR (espaces insécables, `·`, `–`) sur les autres langues : le formatage passe par `Intl`.
- Le ton « expert chaleureux » est invariant ; seule sa déclinaison linguistique change.

### 3.7 Formatage des données

Toute donnée chiffrée ou datée affichée passe par un helper de formatage — jamais de concaténation manuelle.

**Prix** : `formatPrice(value, { decimals = 2 })` obligatoire pour tout montant (wrapper `Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' })`, la locale suit la langue active i18next — rules.md §23). Rendu FR : « 89,99 € » (virgule décimale, espace avant €), milliers groupés « 1 299 € ». **`toFixed` est interdit** sur un montant affiché (point décimal anglais). Prix rond en carte : « 89 € » (`decimals = 0`).

**Volumes** : « 100 ml » — espace fine insécable entre valeur et unité.

**Pourcentages** : `formatDiscount` / `formatVariationPct` (`Intl.NumberFormat(locale, { style: 'percent' })`) — le signe, l'espace et le signe moins suivent les conventions ICU de la locale active (« −23 % » en FR, « -23% » en EN). Jamais de glyphes manuels (U+2212) ni de concaténation.

**Dates** : relatives sous 7 j (« aujourd'hui », « hier », « il y a 3 j »), absolues au-delà (« 12 juil. 2026 »). Jamais de format ISO affiché.

**Chiffres alignés** : `tabular-nums` (§3.5) reste obligatoire dès que des valeurs sont juxtaposées.

---

## 4. Patterns UI récurrents

### 4.1 Carte parfum (`ParfumCard`)

#### Carousel (rangées horizontales)

```
┌──────────────────┐
│ -X%          ❤️  │
│   [image 186]    │
│                  │
├──────────────────┤
│ MARQUE           │
│ Nom du parfum    │
│ [Famille] ★4,4 ♂ │
│ — €              │
└──────────────────┘
```

- Largeur fixe 140 px, défilement horizontal dans un `CatalogRow` (carrousel)
- `borderRadius: card (16)`, ombre `shadow.card`
- Badge promo `deal` (teal) top-left ; cœur `FavButton` top-right
- Titre Playfair 14 px sur 2 lignes max, `ellipsizeMode: 'tail'`
- Chips sous le nom : famille · note communauté · genre (`flexWrap`, peut passer sur 2 lignes en 140 px)
- Zone prix présente : prix + prix barré + price dot (deal/fair/overpriced)
- Image : `contentFit="contain"` (flacon entier, pas de crop), fond `surface` + `placeholder`
- **Non soumis à la densité** (§4.17) : le mode est forcé sur les rangées, le toggle de grille est sans effet ici

#### Comfortable (liste, résultats de scan)

```
┌──────────────────────────┐
│                          │
│       [image 180]        │ badge -X% top-right
├──────────────────────────┤
│ MARQUE                    │
│ Nom du parfum             │
│ [Famille] [2024]          │
│ Tête  note · note · note  │
├──────────────────────────┤
│ Dès  89.99 €  120.00 €   │ fond dealSoft
│            Voir l'offre → │
└──────────────────────────┘
```

- `marginHorizontal: 16`, `marginVertical: 6`
- Ombre `shadow.card`
- Badge promo : `reward` (doré), texte `Inter_800ExtraBold` 13px
- Notes de tête limitées à 3, jointes par " · "
- Zone prix en bas avec `borderTopWidth: hairlineWidth` + fond `dealSoft`
- CTA "Voir l'offre" en `Inter_700Bold` couleur `primary`

#### Placeholder sans image

Quand l'image est absente ou échoue : fond de couleur déterministe basée sur la marque (hash → palette 8 couleurs), initiale en Inter 700 72px blanc 50% opacité.

### 4.2 Bouton (`Button`)

4 variantes, toujours en `Inter_600SemiBold`.

| Variante | Fond | Texte | Hauteur | Border | Ombre |
|---|---|---|---|---|---|
| `primary` | `primary` | `#FFF` | 50 | — | `shadow.button` (violette) |
| `secondary` | `secondary` (doré) | `#FFF` | 50 | — | dorée (shadowOpacity: 0.25) |
| `outline` | transparent | `primary` | 50 | 1.5px `primary` | — |
| `ghost` | transparent | `primary` | 50 | — | — |

États :
- **Loading** : `ActivityIndicator` remplace l'icône, même couleur que le texte
- **Disabled** : `opacity: 0.5` (0.4 pour ghost)
- **Pressed** : `opacity: 0.85` sauf ghost → fond `primarySoft`
- **Avec icône** : Ionicons 20px, `marginRight: 2` avant le texte

`borderRadius: base (12)`, `paddingHorizontal: 24`, `gap: 8`.

### 4.3 Chip / Filtre

#### Chip famille olfactive (tags)
```tsx
backgroundColor: t.colors.primarySoft
color: t.colors.primaryInk
fontFamily: 'Inter_500Medium'
fontSize: 11, paddingHorizontal: 10, paddingVertical: 4
borderRadius: 20
```

#### Chip sélecteur pyramide
```tsx
// État inactif : fond surface2, bordure transparente
// État actif : fond layerSoft, bordure layer.color
flexDirection: 'row', alignItems: 'center', gap: 6
paddingHorizontal: 14, paddingVertical: 10   // 44px hauteur totale
borderRadius: 20, borderWidth: 1
// Dot 8×8 + label Inter 500 13px + compteur
```

> La hauteur totale doit atteindre **44 px** (10+10+8+8+8 = 44 avec dot 8px et paddingVertical 10). Si le paddingVertical est plus petit, ajouter `hitSlop={{ top: 5, bottom: 5 }}` sur le `Pressable` parent.

#### Chip note (pyramide)
```tsx
// Fond layer.color (solide), texte blanc
backgroundColor: layer.color
color: '#FFFFFF'
fontSize: 12, fontFamily: 'Inter_500Medium'
paddingHorizontal: 12, paddingVertical: 5
borderRadius: 14
```

### 4.4 Badge prix/promo

```tsx
// Badge promo (-X%) — toujours positionné top-right de l'image
position: 'absolute', top: 12, right: 12
backgroundColor: t.colors.reward  // doré
color: '#1F1A2E'                  // texte foncé sur doré — invariant
fontFamily: 'Inter_800ExtraBold', fontSize: 13
paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20
```

```tsx
// Badge discount dans PriceDisplay — à côté du prix
backgroundColor: color             // deal/fair/overpriced
color: '#FFFFFF'                   // blanc invariant
fontFamily: 'Inter_700Bold', fontSize: 13
paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10
```

### 4.5 Empty State (`EmptyState`)

6 variantes : `collection | favoris | historique | wardrobe | scentlist | alertes`.

```
        ┌──────┐
        │  🧪  │  icône Ionicons 32px dans cercle 72×72 fond primarySoft
        └──────┘
   Titre (Playfair 700, 20px)
   Description (Inter 400, 14px, textMuted, lineHeight 21)
   [       Bouton primary       ]
```

- Container centré, `paddingTop: 40`, `paddingHorizontal: 24`
- Description `maxWidth: 300`
- CTA = bouton primary, `minWidth: 220`

### 4.6 Section Header (`SectionHeader`)

```tsx
// Row : titre à gauche, action à droite (optionnelle)
flexDirection: 'row', justifyContent: 'space-between'
// Titre : Playfair 700, 18px, text
// Sous-titre optionnel : Inter 400, 13px, textMuted
// Action : Inter 600, 14px, primary
// HitSlop: 12 sur l'action
```

### 4.7 Loading

Pas de skeleton screen. L'app utilise des chargements contextuels :
- **Scan loading** : particules flottantes + halo rotatif + texte cyclique
- **Boutons** : `ActivityIndicator` à la place de l'icône, même couleur que le texte
- **Images parfum** : placeholder pleine couleur — cible : couleur dominante du flacon stockée à l'import ; fallback actuel : couleur de marque déterministe (§4.1). Jamais de gris générique
- **Premier chargement catalogue** : `AppLoader` brandé, borne 1.5 s max avant contenu

### 4.8 Champ texte (`TextInput`)

```tsx
// Style de base pour tous les champs de saisie
backgroundColor: t.colors.surface
borderWidth: 1
borderColor: t.colors.border
borderRadius: t.radius.base     // 12
height: 44
paddingHorizontal: 14
fontFamily: 'Inter_400Regular'
fontSize: 15
color: t.colors.text
placeholderTextColor: t.colors.textMuted
```

### 4.9 Titre de section éditorial (fiche détail)

Pastille 28×28 (`tintSoft`) + Ionicons 14px (`tint`) + titre PlayfairDisplay_600SemiBold 18px + sous-titre optionnel Inter_400Regular 12px `textMuted`. La teinte est sémantique : `deal` → marchands/prix, `perf` → performance (« Tenue & sillage », pastille + crans), `primary` (défaut) → contenu olfactif, temporalité (« Quand le porter ») et recommandation. `secondary`/`reward` restent strictement décoratifs (badge promo, distinction « signature ») — **jamais** une pastille de section ni une action de navigation (sinon 2ᵉ accent chaud, §2.4). Remplace tout titre de section à emoji.

### 4.10 Colonnes de saison (dataviz)

4 colonnes égales (`flex: 1`, gap 8) : icône 15px dans cercle 30px, barre verticale 8×44px ancrée en bas (`justifyContent: 'flex-end'`, track `surface2`), label Inter_500Medium 11px. Fill = `ratio score/max` (min 10% si score > 0 ; barre fantôme 6% couleur `border` si 0). Meilleure saison : pastille `seasonXxxSoft`, label `Inter_600SemiBold` couleur `text`. Aucune valeur numérique ni label négatif : la dataviz relative suffit.

### 4.11 Barre d'action flottante

Barre persistante de bas d'écran (fiche détail) : carte `surface` flottante (`borderRadius: card`, `shadow.elevated`, marges 12px latérales, `paddingBottom: insets.bottom + 12`) — même langage que le DockBar, jamais de barre pleine largeur avec `borderTop`. Apparition en slide-in (`translateY 60→0` + fade) quand la section de référence sort de l'écran. Contenu : prix compact Inter_800ExtraBold 20px + actions 44px + CTA primary.

### 4.12 Planche annotée (dataviz « carnet de nez »)

Figure géométrique centrale (triangle, jauge, courbe) flanquée de deux colonnes d'annotations : labels sérifiés à gauche (label signature §3.2), métadonnées chiffrées à droite (`Inter_400Regular` 10–11, `textMuted`, `tabular-nums` §3.5, hairline 12 px `border` en préfixe). Séparation des strates par **gaps réels** (inset de 3 px vers le centroïde), jamais par stroke. Remplissage en `LinearGradient` diagonal (`x1=0 y1=0 x2=1 y2=1`) couleur → couleur assombrie 12 % (éclaircie 8 % en dark). **Texture gravure** optionnelle : `Pattern` SVG de hairlines diagonales à 4–6 % d'opacité par-dessus les strates — effet planche d'herbier, doit rester subliminal (si on la remarque au premier regard, elle est trop forte). Chaque rangée (label + figure + annotation) forme une cible tactile unique ≥ 64 px avec `accessibilityRole="button"` et un label explicite.

### 4.13 Pétale de note

Évolution du chip note : fond `layerSoft`, bordure 1 px `layerColor` à 35 % (helper `alpha()`), texte `Inter_500Medium` 13 `layerInk`, emoji de catégorie 13 px en préfixe. `paddingHorizontal: 12`, `paddingVertical: 8`, `borderRadius: 20`. Pressé : `scale: 0.95`, `opacity: 0.8`. Entrée staggered `FadeInDown.delay(i * 55)`. Remplace le chip note pleine couleur (§4.3) sur toute nouvelle UI ; l'ancien chip reste toléré sur les surfaces existantes non refondues.

### 4.14 Voile ambiant & halo de strate

Nappe lumineuse `RadialGradient` (couleur de strate → transparent, centre `alpha` 0.10–0.14) en position absolue **derrière** une section signature, débordant du padding latéral (bleed pleine largeur, `pointerEvents="none"`). Opacité plafonnée : 0.5 light / 0.35 dark. Changement de teinte par crossfade de deux couches superposées — jamais d'animation de `<Stop>`. N'enfreint pas la règle « `background` jamais sur carte » : le voile est un éclairage du fond de page, pas un fond de conteneur. Maximum **un** voile par écran.

### 4.15 Iconographie (Ionicons)

Une seule famille : `@react-native-vector-icons/ionicons`. Cinq tailles, un style.

| Taille | Contexte |
|---|---|
| 14 | Pastilles de titre de section (§4.9), chips |
| 16 | Inline avec texte 13–14 (durées, métadonnées) |
| 20 | Boutons, rows de liste, onglets |
| 24 | FAB central (56 × 56) |
| 32 | Empty states (cercle 72 × 72) |

- **Outline partout** (suffixe `-outline`), trois exceptions filled : cœur favori actif, étoiles de rating, icônes d'onglet actives dans le DockBar.
- Couleur : `textMuted` par défaut ; `xxxInk` dans une pastille `xxxSoft` ; `#FFFFFF` (§2.3) sur bouton ou FAB plein. `primary` seul uniquement si l'icône EST l'action.
- Cohérence sémantique : `time-outline` = temporalité, `flask` = parfumerie, `layers-outline` = structure olfactive, `color-filter-outline` = accords. Ne pas introduire une seconde métaphore pour un concept déjà pourvu.
- Aucun emoji en remplacement d'une icône UI (les emojis de catégories olfactives restent confinés aux pétales §4.13 et au popup note).

### 4.16 Bottom sheet (unifié)

Spec commune à toutes les sheets (ActionSheet, FilterSheet, TrySheet, BrandSheet, WardrobeAddSheet, WardrobeQuickSheet, SOTDPicker). Deux types, une anatomie partagée.

**Anatomie commune**
- Backdrop : palier `scrim` (§2.5), tap = fermer
- Container : `surface`, `borderTopLeftRadius` / `borderTopRightRadius` : 24 — la sheet est un niveau d'élévation au-dessus des cartes, radius distinct du `card` (16)
- Handle : barre 36×4 `textMuted` au palier `dim`, centrée, `marginTop: 8` — content sheet uniquement
- `paddingBottom: insets.bottom + 12` ; hauteur max 85 % de la fenêtre
- Back Android = fermer

**Action sheet** (menu d'actions) : rows 44 px (icône 20 + label `Inter_500Medium` 15), destructive en `overpriced`, auto-dismiss après action, pas de footer. Implémentation canonique : `src/components/ActionSheet.tsx`.

**Content sheet** (formulaire, liste, filtres) : header (titre `PlayfairDisplay_600SemiBold` 18 + méta optionnelle), contenu scrollable borné, footer sticky avec `borderTopWidth: hairlineWidth` + CTA primary pleine largeur (label au résultat : « Voir les 12 parfums »). Pas d'auto-dismiss.

**Motion** : entrée `withTiming(250, Easing.out(Easing.cubic))` (translateY pleine hauteur → 0) + fade backdrop ; sortie 200 ms `Easing.in`. Spring uniquement si drag-to-dismiss gestuel (non requis en v1).

**État actuel** : les 7 sheets existantes dérivent de ces deux types ; les écarts (handle, radius, motion) sont grand-père — aligner à la prochaine retouche de chaque sheet, sans big bang.

### 4.17 Densité d'affichage

Trois densités de carte — `comfortable` (défaut), `compactPlus`, `list` — partagées par toutes les grilles 2 colonnes de `ParfumCard` (catalogue, recherche, favoris).

- **Contrôle** : toggle d'icônes dans le header de grille (cycle comfortable → compactPlus → list), icônes 20 px `textMuted`, actif `primary`
- **Persistance** : `useDensityPreference` (AsyncStorage) — une seule préférence pour toutes les grilles, pas de réglage par écran
- **Interdiction** : changer de densité ne déclenche ni fetch ni re-tri (gridKey stable hors thème)
- Les rangées éditoriales horizontales (`carousel`) ne sont pas soumises à la densité

### 4.18 Retour d'action (feedback)

Politique : **pas de toast**. Le feedback d'une action réussie = haptique (§2.6) + mutation visuelle immédiate de la source (cœur rempli, badge ownership, compteur incrémenté). C'est un choix de marque — la retenue fait partie du luxe.

Si une confirmation cross-écran devient indispensable (action non visible à l'écran résultat) : bannière unique ancrée au-dessus du DockBar, même langage qu'`OfflineBanner` (hairline `border`, `surface`, slide-down 250 ms, auto-dismiss 2.5 s, icône 16 `deal`). Une seule bannière à la fois ; jamais sur l'écran source de l'action.

---

### 5.1 Grille de spacing

```
xs   = 4   → micro-gap (icône↔texte, dot↔label)
sm   = 8   → gap entre éléments liés (tags, boutons jumeaux)
base = 12  → padding intérieur carte, gap entre chips
md   = 16  → marge horizontale standard, padding card header
xl   = 24  → padding CTA, espace après titre, espacement entre sections majeures
2xl  = 32  → espace après un bloc majeur
3xl  = 48  → rare — espacement global
```


### 5.2 Marges entre sections

```
┌─────────────────────────────────┐
│ paddingTop: safe area top       │
│                                 │
│ [Section titre]                 │
│ marginBottom: 16                │
│ [Contenu section]               │
│ marginBottom: 24                │
│ [Section suivante]              │
│                                 │
│ paddingBottom: safe area bottom │
└─────────────────────────────────┘
```

- `marginHorizontal: 16` sur les cartes et le contenu
- `marginVertical: 6` entre cartes dans une liste
- Espacement entre sections majeures : `marginTop: 24` ou `marginBottom: 24`
- Entre un titre de section et son contenu : `marginBottom: 12` ou `16`

### 5.3 Padding cartes

| Type | Padding |
|---|---|
| Carte normale (ParfumCard comfortable) | header 16px, body 16px horizontal / 8px vertical |
| Carte de rangée (ParfumCard carousel) | header 10px, body 10px horizontal / 4px vertical |
| PriceDisplay | 16px tout autour |
| Zone deal (ParfumCard footer) | 12px tout autour |
| OlfactoryPyramid container | 16px horizontal / 14px vertical |
| EmptyState | 40px top, 24px horizontal |

### 5.4 Radius

```
sm   = 8   → coins viseur scan, badge discount
base = 12  → boutons, inputs
card  = 16 → cartes parfum, PriceDisplay, pyramide NotesWrap
full  = 9999 → cercles (icône, halo, scan FAB)
```


### 5.5 Bordures

- Séparateurs : `borderTopWidth: StyleSheet.hairlineWidth`, couleur `border`
- Outline (bouton outline, scan import) : `borderWidth: 1.5`, couleur `primary`
- Chip sélecteur actif : `borderWidth: 1`, couleur variable
- Ring pyramide : `borderWidth: 2` (inactif) / `3` (actif)

---

## 6. Règles spécifiques mobile

### 6.1 Zone de pouce

Les actions principales sont placées dans la **moitié inférieure** de l'écran :
- Bouton "Scanner un flacon" → centré verticalement ou plus bas
- FAB scan → en bas à droite (onglet central)
- CTA fiche détail → après le scroll (visible sans scroller sur mobile standard)
- Boutons d'action profil → dans la zone visible

### 6.2 Taille minimale des cibles tactiles

**44 px minimum** (recommandation Apple HIG et Material Design).  
Si un élément est plus petit, utiliser `hitSlop` **explicite** pour agrandir sa zone tactile :

```tsx
// ✅ Correct — le chip fait 34px, hitSlop compense
<Pressable hitSlop={{ top: 5, bottom: 5, left: 4, right: 4 }}>

// ❌ Incorrect — zone tactile insuffisante sans hitSlop
<Pressable style={{ height: 34 }}>
```

Vérifications dans le code :
- `Button` : hauteur 50 px ✓
- `Pressable` dans `ScanIdle` : hauteur CTA 54px, outline 48px ✓
- Chip sélecteur pyramide : ~34px → `hitSlop={{ top: 5, bottom: 5 }}` pour atteindre 44px
- `SectionHeader` action : `hitSlop: 12` explicite ✓
- `ParfumCard` lien "Voir l'offre" : `hitSlop: 8` ✓
- Pastille compteur pyramide : cible = label + dot + compteur (bouton complet) ✓

### 6.3 Edge-to-edge et safe areas

L'app utilise `react-native-safe-area-context` :

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const insets = useSafeAreaInsets();
```

**Règle** : chaque écran full-screen gère ses propres safe areas. Ne pas wrapper toute l'app dans un SafeAreaView global.

Cas spécifiques :
- **Scan idle** : `paddingTop: insets.top + 16`, tip à `bottom: 24 + insets.bottom`
- **Scan camera** : plein écran, pas de padding
- **Fiche détail** : `SafeAreaView` avec `edges={['top']}`, scroll gère le bas
- **Auth** : `SafeAreaView` complet
- **Écrans à scroll** : `SafeAreaView` avec `edges={['bottom']}` uniquement (le header est dans le scroll)

### 6.4 Barre de navigation Android

La couleur de fond de la barre système Android suit le thème actif :
```tsx
NavigationBar.setBackgroundColorAsync(theme.colors.background);
```
(Appelé dans un `useEffect` du `ThemeProvider` — `expo-navigation-bar` requis.)

### 6.5 StatusBar

Gérée dynamiquement par `ThemeContext` :
```tsx
<StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
```
Pas de `StatusBar` dans les écrans individuels.

### 6.6 Accessibilité — Texte agrandi

Les utilisateurs peuvent activer « Texte plus grand » dans les réglages du téléphone. React Native applique par défaut un facteur d'échelle à tous les `fontSize`, ce qui peut casser les layouts.

**Règles :**

1. **Textes longs** (descriptions, paragraphes) : `maxFontSizeMultiplier={1.3}` — permet un agrandissement modéré sans débordement.
2. **Éléments critiques** (badges, chips, compteurs, prix) : `allowFontScaling={false}` — taille fixe car le design est calibré.
3. **Test obligatoire** : activer « Texte plus grand → Maximum » dans les réglages et vérifier que l'UI ne casse pas.

```tsx
// ✅ Correct — le badge prix ne se déforme pas
<Text allowFontScaling={false} style={s.priceText}>89.99 €</Text>

// ✅ Correct — la description s'adapte raisonnablement
<Text maxFontSizeMultiplier={1.3} style={s.description}>
  {longDescription}
</Text>
```

**Contrastes minimum** (WCAG AA) :
- Texte normal : ratio ≥ 4.5:1
- Texte large (≥18px bold ou ≥24px) : ratio ≥ 3:1
- Vérifiés : `text`/`background` ~15:1 ✓, `textMuted`/`surface` ~4.8:1 ✓
- Light : `textMuted` (`#6E6963`) sur `surface` ≈ 5.4:1 ✓, sur `background` ≈ 5.0:1 ✓

### 6.7 Reduced Motion (obligatoire)

Le réglage système « Réduire les animations » est respecté partout :

- **Boucles infinies** : coupées (halo + particules ScanLoading, particule pyramidale §7.5, speed lines runner)
- **Animations d'entrée** : remplacées par un crossfade simple (opacity uniquement, 150 ms)
- **Springs** : remplacés par `withTiming(0)`
- **Gestes** : inchangés (le mouvement suit le doigt — ce n'est pas une animation)
- **Runner** : shake et flash de mort désactivés

Une seule source de vérité : `useReducedMotion()` (fourni par Reanimated) via un hook maison canonique — jamais de lecture ad hoc par composant.

### 6.8 Dataviz & information couleur-seule

- Toute barre, jauge ou pastille dataviz porte un `accessibilityLabel` verbalisant la valeur relative — ex. colonnes de saison (§4.10, sans chiffres à l'écran) : « Été : 4 sur 5 »
- Information couleur-seule (price dots deal/fair/overpriced en carousel/compactPlus) : toujours doublée d'un texte adjacent ou d'un label a11y énonçant le verdict (« bonne affaire », « prix correct », « trop cher »)
- Contraste non-texte ≥ 3:1 entre fill et track des dataviz (barres saisonnières vs `surface2`) — re-mesurer à la première modification de ces tokens
- Icônes décoratives : `accessible={false}` (ou `importantForAccessibility="no-hide-descendants"` sur le parent)
- Cartes : pattern « label composé » — un seul `accessibilityLabel` de phrase (nom, marque, prix, verdict) plutôt que des enfants vocalisés séparément. Canonique : `ParfumCard`

---

## 7. Guidelines animation/transition

### 7.1 Ressorts vs timing

| Contexte | Animation | Configuration |
|---|---|---|
| Appui bouton | `Pressable` `pressed` state | Instantané (`opacity: 0.85`) |
| Apparition prix | `withSpring` | `stiffness: 200, damping: 10` |
| Entrée séquentielle (pyramide) | `withDelay` + `withTiming` | `delay: i * 150ms`, `duration: 200ms` |
| Respiration (halo scan) | `withRepeat` + `withTiming` | `duration: 2000ms`, `Easing.inOut(Easing.ease)` |
| Changement de thème | `LayoutAnimation.configureNext` | `LayoutAnimation.Presets.easeInEaseOut` |
| Swipe inter-onglets (TopTabs) | natif (pager-view) | Indicateur doré continu via `position` |
| Gesture sheet (catalogue) | `Gesture.Pan()` → `withSpring` | `damping: 20, stiffness: 200` |
| Slide down (OfflineBanner) | `withSpring` | Entrée/sortie fluide |

### 7.2 Durées recommandées

```
Feedback immédiat (pressé)       → 0ms (natif Pressable)
Transition d'état (loading→résultat) → 200–300ms
Entrée de page (apparition)      → 300–400ms
Animation d'attention (halo)     → 2000ms (boucle)
Animation séquentielle           → 150ms par élément
Transition thème                 → 300ms (LayoutAnimation)
```

### 7.3 Règles Reanimated

- **Toujours `cancelAnimation` dans le cleanup** des `useEffect` qui lancent des `withRepeat` (sinon fuite mémoire).
- **`runOnJS` pour les callbacks** depuis un worklet UI vers le thread JS :
  ```tsx
  const onCapture = () => { /* setState, navigation... */ };
  // Dans le worklet :
  runOnJS(onCapture)();
  ```
- **`useDerivedValue`** crée une valeur dérivée réactive. Le second argument (tableau de dépendances) est optionnel — il n'est utile que sur le Web sans le plugin Babel Reanimated. En pratique dans ce projet, on l'omet :
  ```tsx
  // ✅ Correct — auto-tracke les SharedValues
  const barBg = useDerivedValue(() => theme.colors.surface);

  // Alternative avec deps explicites (Web sans Babel uniquement)
  const dv = useDerivedValue(() => sv.value + 1, [sv]);
  ```
- **Ne pas mélanger `withSpring` et `withTiming` dans une même séquence** sans raison. Spring = interactif/gestuel, timing = prédéfini.
- **Fade avant scale** : toujours `opacity` en même temps que `scale` pour éviter un "pop" brutal.

### 7.4 Easing pour les gestures

```tsx
// Swipe horizontal (pager onglets)
withSpring(offset, { damping: 50, stiffness: 300 })

// Snap après drag
withSpring(snapPoint, { damping: 20, stiffness: 200 })

// Entrée fluide (pas d'overshoot)
withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) })

// Respiration (boucle infinie)
withRepeat(
  withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
  -1,  // répétitions infinies
  true  // reverse (aller-retour)
)
```

### 7.5 Budget d'animations ambiantes

Maximum **une boucle infinie** visible par écran (ex. la particule de sillage de la pyramide). Toute autre animation d'attention doit être **bornée** : `withRepeat(anim, count, true)` avec `count ≤ 4`, déclenchée par une interaction (sélection, apparition), puis stabilisée. Toute boucle infinie conserve son `cancelAnimation` au cleanup (§7.3). Si deux boucles semblent nécessaires, la plus discrète devient bornée — jamais deux sources de mouvement perpétuel dans le même champ visuel.

Inventaire sanctionné des boucles infinies (exhaustif) : halo + particules ScanLoading, particule de sillage pyramide, speed lines runner. Toute nouvelle boucle en remplace une existante.

### 7.6 Transitions de navigation & shared element

**Transitions canoniques** (expo-router, déjà en place) :

| Contexte | Animation |
|---|---|
| Navigation avant (fiche, settings, légal…) | `slide_from_right` |
| Recherche | `fade` |
| Scan | `slide_from_bottom` |
| Onglets | swipe natif pager — indicateur (pill) glisse au spring sur l'onglet actif |

**Shared element signature — flacon** : à l'ouverture d'une fiche depuis une `ParfumCard`, l'image du flacon continue visuellement vers le `DetailHero` (translation + scale + crossfade du fond carte → hero, ~300 ms `Easing.out(Easing.cubic)` ; le contenu de la fiche entre en stagger après 60 % de progression).

Règles :
- **Un seul** shared element dans l'app — c'est la signature, pas un pattern généraliste
- Fallback automatique : slide simple si Reduced Motion (§6.7) ou si la mesure de la carte source échoue
- L'image partagée devient le hero du `CollapsingHeader` — pas de double rendu pendant la transition

---

## 8. Dark mode

### 8.1 Changements de couleurs

Tous les tokens changent — voir `theme.ts` pour le mapping complet. Résumé des transformations clés :

| Token | Light | Dark | Principe |
|---|---|---|---|
| `background` | `#F8F6F2` beige craie | `#0B0712` violet-noir | Fond profond, pas noir pur |
| `surface` | `#FFFFFF` | `#15101E` | Surfaces légèrement au-dessus du fond |
| `surface2` | `#F3F1ED` | `#1D1728` | Troisième niveau de profondeur |
| `primary` | `#6C3ED9` | `#8B6CF6` | Plus clair pour contraste sur fond sombre |
| `secondary` | `#C8945A` | `#D4A960` | Doré plus lumineux |
| `deal` | `#0D9488` | `#2DD4BF` | Teal plus vibrant |
| `text` | `#1A1520` | `#EDE8F5` | Blanc cassé chaud |
| `textMuted` | `#6E6963` | `#988EA8` | Gris à sous-ton violet |

**Règle** : les couleurs soft/ink suivent leur couleur parente. Les couleurs sémantiques s'éclaircissent en dark mode.

### 8.2 Ombres → Bordures

En dark mode, les ombres noires sont invisibles. Tous les `shadow` tokens sont remplacés :

| Shadow token | Light | Dark |
|---|---|---|
| `shadow.card` | `shadowOpacity: 0.06`, `shadowRadius: 12`, `elevation: 3` | `borderWidth: 0.5`, `borderColor: rgba(255,255,255,0.06)` |
| `shadow.elevated` | `shadowOpacity: 0.08`, `shadowRadius: 16`, `elevation: 6` | `borderWidth: 1`, `borderColor: rgba(255,255,255,0.08)` |
| `shadow.button` | ombre violette `shadowOpacity: 0.3` | `borderWidth: 1`, `borderColor: rgba(139,108,246,0.25)` |
| `shadow.scanCircle` | ombre violette `shadowOpacity: 0.4` | `borderWidth: 1.5`, `borderColor: rgba(139,108,246,0.30)` |

**En pratique** : le spread `...t.shadow.card` fonctionne dans les deux thèmes sans changement de code. Pour une carte à contenu clippé (`overflow: 'hidden'`), le pattern canonique est un **wrapper non clippé** portant `t.cardShadow` (light : ombre ; dark : `noShadow`) + bordure `t.cardBorder`/`t.hairline` sur le contenu clippé — l'elevation Android ne doit pas être coupée par le radius.

### 8.3 Contraste

- Ratio texte/fond ≥ 4.5:1 (WCAG AA) pour le texte normal
- `text` (`#EDE8F5`) sur `background` (`#0B0712`) = ratio ~15:1 ✓
- `textMuted` (`#988EA8`) sur `surface` (`#15101E`) = ratio ~4.8:1 ✓
- `primary` (`#8B6CF6`) sur `background` (`#0B0712`) = ratio ~5.5:1 ✓

### 8.4 Éviter le noir pur

- Le fond n'est **jamais** `#000000`. Le `#0B0712` a un sous-ton violet qui adoucit le dark mode.
- Les surfaces (`#15101E`, `#1D1728`) restent dans des écarts de luminance faibles (~3–5%).
- Les textes ne sont jamais blanc pur (`#FFFFFF`) — le `#EDE8F5` est un blanc cassé chaud.

### 8.5 Comportement dynamique

- **Mode système** : `useColorScheme()` natif, changement immédiat.
- **Persistance** : choix `system | light | dark` dans AsyncStorage (`@sillage/theme`).
- **Pas de flash** : le `ThemeProvider` bloque le rendu (`{ready ? children : null}`) tant que la préférence n'est pas chargée.
- **StatusBar** : suit automatiquement le mode résolu.

### 8.6 Compensation optique (dark)

- **Graisse** : sur fond sombre, le corps long (descriptions, listes) descend d'un cran de graisse (500 → 400) — Inter paraît plus gras en inverse vidéo ; display et titres inchangés
- **Élévation mesurée** : `background` → `surface` → `surface2` = 3 marches de luminance (ΔL* ≤ 5 % entre marches, jamais de noir pur §8.4) — toute nouvelle surface dark se mesure, ne s'estime pas
- **Conteneur image flacon** : hairline `border` permanente sur le conteneur (WebP détourés §16 pipeline projet — flacon clair sur surface claire, flacon sombre sur surface sombre = invisible sans ring)

---

## 9. Adaptive & grands écrans

L'app est mobile-first portrait ; les grands écrans sont servis par adaptation, pas par refonte :

- **Orientation** : portrait uniquement, partout (politique verrouillée — le scan l'exige)
- **Largeur max contenu texte** : 480 px centré (légal, privacy, settings, auth)
- **Grilles** : 2 col < 600 dp, 3 col ≥ 600 dp, 4 col ≥ 900 dp
- **Sheets** (§4.16) : ≥ 600 dp → carte centrée max 560 px, radius 24 complet (plus de bottom sheet)
- **DockBar** : max-width 380 (déjà) — inchangé
- **Breakpoints** : sur `useWindowDimensions().width` — jamais de détection d'appareil

---

## Annexe A — Architecture technique

### A.1 Structure des fichiers

```
src/theme/
├── theme.ts             ← lightTheme + darkTheme (tokens complets)
├── ThemeContext.tsx      ← ThemeProvider + useTheme()
└── (pas de theme-utils.ts séparé)

Polices : chargées dans app/_layout.tsx via useFonts (expo-font) +
@expo-google-fonts/inter (400/500/600/700/800) et
@expo-google-fonts/playfair-display (500/600/700/700-italic).
Le rendu de l'app est bloqué (splash maintenu) jusqu'à fontsLoaded —
toute fontFamily référencée dans le code DOIT exister dans ce useFonts.

src/services/
└── theme-storage.ts     ← AsyncStorage, clé @sillage/theme
```

### A.2 Pattern getStyles

Chaque composant suit ce pattern :

```tsx
import { useTheme, type Theme } from '../theme/ThemeContext';

export default function MonComposant() {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  // ...
}

function getStyles(t: Theme) {
  return {
    container: { backgroundColor: t.colors.surface },
    title: { color: t.colors.text, fontFamily: t.fonts.display.fontFamily },
  } as const;
}
```

**Règles :**

- `getStyles` est une **fonction pure** hors du composant — testable, sans dépendance React.
- Les styles sont memoïsés avec `useMemo(() => getStyles(theme), [theme])`.
- `StyleSheet.create` n'est **pas** utilisé pour les styles thématiques car ils dépendent du thème (dynamique). Le `useMemo` suffit à éviter la recréation d'objets. Pour les styles **statiques** (layout pur, sans couleurs), `StyleSheet.create` reste le pattern recommandé — il fournit du typage statique et un ID natif optimisé (cf. [docs RN](https://reactnative.dev/docs/stylesheet)).
- L'exception : `ErrorBoundary` (composant classe) utilise `getStyles(lightTheme)` directement — seul cas où `useTheme()` est impossible.
- **Jamais** importer `theme` depuis `theme.ts` dans un composant fonctionnel — toujours `useTheme()`.

### A.3 ThemeProvider vs AuthProvider

`ThemeProvider` wrap `AuthProvider` → le thème est disponible **sans authentification**. Les écrans de login et register bénéficient du dark mode.

### A.4 Tokens dépréciés

- `spacing.lg` (20), ancien `spacing.xl` (devenu 24), `radius.lg` (20), `radius.xl` (24) — morts (0 consommateur dans `src/`), toujours présents dans `theme.ts` pour rétrocompatibilité ; ne pas utiliser dans le nouveau code
- `violetInk` — doublon exact de `primaryInk` (mêmes valeurs light/dark) ; consommé par 3 composants (ParfumCard, ScanClarify, FamilyAmbianceCards) : migrer vers `primaryInk` à la prochaine retouche de ces fichiers, puis retirer l'alias

---

## Annexe B — Checklist de conformité

### Nouveau composant
- [ ] Utilise `useTheme()` (pas `import { theme }`)
- [ ] Styles dans `getStyles(t: Theme)` → `useMemo(() => getStyles(theme), [theme])`
- [ ] Aucun `fontWeight` → tout en `fontFamily`
- [ ] Toute `fontFamily` utilisée existe dans le `useFonts` de `app/_layout.tsx`
- [ ] Données saisonnières → tokens `seasonXxx`, jamais `deal`/`fair`/`secondary`
- [ ] Dataviz luxe → pattern planche annotée §4.12 (gaps par inset, labels sérifiés, `tabular-nums`)
- [ ] Italique éditorial → max 2 lignes/écran, voix distinctes, non adjacentes (§3.2)
- [ ] Boucles infinies → 1 max/écran, autres bornées ≤ 4 répétitions (§7.5)
- [ ] Transparences → paliers §2.5 (`alpha()` + palier, dark lumineux ÷2, structure inchangé)
- [ ] Icônes → tailles §4.15 (14/16/20/24/32), outline, couleur selon contexte
- [ ] Copy → tutoiement, cadratin `–`, `·`, pas de « ! », ligne éditoriale ≤ 6 mots à métaphore sensorielle
- [ ] Couleurs via tokens (`t.colors.xxx`), jamais en dur (sauf §2.3)
- [ ] Ombres via `t.shadow.xxx`, jamais en dur (cartes clippées : wrapper `t.cardShadow` + `t.cardBorder`/`t.hairline`)
- [ ] Radius via `t.radius.xxx`
- [ ] Cibles tactiles ≥ 44 px (ou `hitSlop` explicite)
- [ ] Safe areas gérées si plein écran
- [ ] Un seul accent par écran (primary OU secondary, pas les deux)
- [ ] Textes longs : `maxFontSizeMultiplier={1.3}`, badges/chips : `allowFontScaling={false}`
- [ ] Handlers passés aux enfants wrappés dans `useCallback`
- [ ] Appels async protégés par `try/catch` ou `.catch(() => {})`
- [ ] Montants via `formatPrice()` — jamais `toFixed` (§3.7)
- [ ] Haptique selon mapping §2.6
- [ ] Boucles et ambiances coupées en Reduced Motion (§6.7)
- [ ] Dataviz couleur-seule vocalisée (§6.8)
- [ ] Bottom sheet conforme §4.16 (backdrop scrim, radius top 24, dismiss)

### Révision design
- [ ] Pas de violet ET doré comme couleurs d'action sur le même écran
- [ ] Pas de `textMuted` sur fond `primarySoft`
- [ ] Pas de fond `background` sur une carte
- [ ] Hiérarchie typographique cohérente
- [ ] Les overlays sur image sont dans un coin, pas flottants
- [ ] Dark mode : les ombres sont-elles visibles ? (sinon → bordures)
- [ ] Dark mode : contrastes texte/fond ≥ 4.5:1
- [ ] Testé avec texte agrandi (réglages → accessibilité → texte plus grand)
- [ ] Testé avec Reduced Motion activé (réglages → accessibilité)
- [ ] Dark mode : graisse du corps long compensée (§8.6)

---

## Annexe C — Composants ↔ patterns

Implémentations canoniques à imiter (ne pas réinventer) :

| Composant | Fichier | Patterns appliqués |
|---|---|---|
| `ParfumCard` | `src/components/ParfumCard.tsx` | §4.1, §4.4, §6.8 (label composé) |
| `Button` | `src/components/Button.tsx` | §4.2 |
| `EmptyState` | `src/components/EmptyState.tsx` | §4.5 |
| `SectionHeader` | `src/components/SectionHeader.tsx` | §4.6 |
| `PriceDisplay` | `src/components/PriceDisplay.tsx` | §4.4, §3.7 (cible) |
| `ActionSheet` | `src/components/ActionSheet.tsx` | §4.16 action sheet |
| `FilterSheet` | `src/components/FilterSheet.tsx` | §4.16 content sheet |
| `SaveSheet` | `src/features/catalog/SaveSheet.tsx` | §4.16 content sheet (application live), §2.6 haptique |
| `DockBar` | `src/features/navigation/DockBar.tsx` | §4.11 langage flottant, §2.3 (overlays volume FAB), §2.5 (halo `tintLuminous`), collapse 3 états |
| `StickyBottomBar` | `src/features/catalog/StickyBottomBar.tsx` | §4.11 |
| `OlfactoryPyramid` | `src/features/catalog/` | §4.12, §4.13, §4.14, §7.5 (particule) |
| `DetailHero` | `src/features/catalog/DetailHero.tsx` | §7.6 shared element (cible) |
| `OfflineBanner` | `src/components/OfflineBanner.tsx` | §4.18 bannière |
| `ScanLoading` | `src/features/scan/ScanLoading.tsx` | §7.5 (halo + particules) |

---

## Changelog

- **1.6** (août 2026) : §2.1 ajout `accord0`–`accord7` ; `textInverse` clarifié (token variable ≠ convention `#FFFFFF` invariante) ; §A.4 corrigé (tokens morts ≠ supprimés) ; EmptyState 6 variantes (+ `alertes`).
- **1.5** (juillet 2026) : §0 quick reference ; §2.6 haptique ; §3.7 formatage données (`formatPrice`) ; §4.16 sheets unifiés ; §4.17 densité ; §4.18 feedback ; §6.7 Reduced Motion ; §6.8 dataviz a11y ; §7.6 shared element ; §8.6 dark optique ; §9 adaptive ; §A.4 tokens dépréciés ; Annexe C. Corrections datées : EmptyState 5 variantes, `textMuted` light `#6E6963`, mentions onboarding supprimées, échelle prix §3.2, §4.7 assoupli.
- **1.4** (juillet 2026) : échelle d'opacité §2.5, copy & voix §3.6, iconographie §4.15.
- **1.3 et avant** : voir l'historique git.
