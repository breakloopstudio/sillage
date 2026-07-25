# SPECIFICATION D'IMPLEMENTATION — Pyramide olfactive v7 « L'Évolution »

> **Destinataire** : agent d'implémentation (DeepSeek V4 Pro).
> **Projet** : ParfumScan React (Expo SDK 57, RN 0.86, Reanimated 4, react-native-svg 15).
> **Design system** : `.clinerules/design-guide.md` **v1.3** — les patterns §3.2 (label signature, italique 2 lignes), §3.5 (tabular-nums), §4.12 (planche annotée), §4.13 (pétale de note), §4.14 (voile ambiant), §7.5 (budget animations ambiantes) ont été ajoutés pour cette feature et sont **normatifs**.
> **Regle absolue** : ce document est un contrat. Toute valeur chiffree, couleur, duree ou signature de fonction doit etre implementee telle quelle. Si une impossibilite technique survient, la signaler plutot que d'improviser.

---

## 0. Regles projet non negociables (rappel)

1. TypeScript strict, **zero `any`**.
2. **Zero `fontWeight`** — uniquement `fontFamily` (`Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`, `PlayfairDisplay_600SemiBold`, `PlayfairDisplay_700Bold_Italic`). Toutes sont deja chargees dans `app/_layout.tsx`.
3. Styles thematiques : fonction pure `getStyles(t: Theme)` hors composant + `const s = useMemo(() => getStyles(theme), [theme])`. `StyleSheet.create` uniquement pour du layout statique sans couleur.
4. Couleurs : **uniquement** `theme.colors.*`. Exceptions autorisees ici : `#FFFFFF` (particule sillage, invariante §2.3).
5. Theme via `useTheme()` — jamais `import { theme } from '...'`.
6. Animations : tout en SharedValues, **zero `setState` en boucle**, `cancelAnimation` dans le cleanup de tout `useEffect` lançant un `withRepeat`.
7. `useCallback` sur tout handler passe a un enfant.
8. Appels async : non concernes ici (composant 100 % synchrone).
9. Accessibilite : cibles tactiles >= 44 px, `accessibilityRole`/`accessibilityLabel` explicites, `allowFontScaling={false}` sur compteurs et annotations temps, `maxFontSizeMultiplier={1.3}` sur les noms de notes.

---

## 1. Concept (intention a preserver)

La pyramide n'est pas un diagramme : c'est **le recit du parfum dans le temps**. Planche annotee facon carnet de nez : triangle texture gravure, flanque de deux colonnes (noms de strates en Playfair a gauche, fenetres temporelles a droite), pose sur un **voile lumineux** qui prend la teinte de la strate active. Une **particule de sillage** descend en boucle du sommet vers la base — **seule boucle infinie autorisee** (§7.5). Les notes s'affichent en **petales** soft/ink. Une ligne editoriale en italique change de voix avec la strate.

---

## 2. Arborescence

```
src/features/catalog/
├── OlfactoryPyramid.tsx          # REECRIT — orchestrateur (path inchange, import de [id].tsx intact)
└── pyramid/
    ├── geometry.ts               # Fonctions pures, zero dependance React — testees
    ├── PyramidStage.tsx          # Scene SVG : bandes, halo, particule, rangees tactiles
    └── NoteCloud.tsx             # Petales de notes staggered
__tests__/
└── pyramid-geometry.test.ts      # ~11 tests unitaires
```

Fichiers modifies hors perimetre pyramide :
- `src/components/NoteDetailPopup.tsx` — nouvelle prop `layer` (upgrade visuel)
- `app/catalog/[id].tsx` — 3 lignes (voir §8)
- `.clinerules/rules.md` §2 + `.clinerules/reference.md` §6 — mettre a jour la mention « OlfactoryPyramid v5 » → « v7 » **apres** implementation reussie

---

## 3. `src/features/catalog/pyramid/geometry.ts` — spec exacte

Fonctions pures exportees. Signature, algo et edge cases figes.

```ts
export type LayerKey = 'top' | 'heart' | 'base';
export interface Pt { x: number; y: number }
```

### 3.1 `shade(hex: string, ratio: number): string`
- `hex` au format `'#RRGGBB'`. `ratio` dans [-1, 1] : negatif assombrit vers 0, positif eclaircit vers 255.
- Algo par canal `c` : `ratio < 0 ? round(c * (1 + ratio)) : round(c + (255 - c) * ratio)`, clamp [0, 255].
- Retour `'#RRGGBB'` uppercase.
- Edge : `shade('#000000', -0.5)` → `'#000000'` ; `shade('#FFFFFF', 0.5)` → `'#FFFFFF'`.

### 3.2 `alpha(hex: string, a: number): string`
- Retour `'rgba(r,g,b,a)'` (decimales conservees, ex. `alpha('#C8945A', 0.35)` → `'rgba(200,148,90,0.35)'`).

### 3.3 `bandPoly(w: number, h: number, k: 0|1|2, gap: number): { points: Pt[]; centroid: Pt; svg: string }`
- Demi-largeur a la hauteur y : `hw(y) = (w / 2) * (y / h)`. Centre `cx = w / 2`, bande de hauteur `bh = h / 3`, `y0 = k * bh`, `y1 = (k + 1) * bh`.
- Sommets bruts dans l'ordre : `(cx - hw(y0), y0)`, `(cx + hw(y0), y0)`, `(cx + hw(y1), y1)`, `(cx - hw(y1), y1)`. Pour k=0 les deux premiers sont confondus → triangle (comportement voulu).
- `centroid` = moyenne des 4 sommets.
- **Inset** : chaque sommet `v` est deplace vers le centroide `c` de `t = min(0.5, gap / dist(v, c))` : `v' = v + (c - v) * t`. Si `dist(v, c) === 0`, laisser `v`.
- `svg` = points formates `'x1,y1 x2,y2 x3,y3 x4,y4'` avec **2 decimales** (`toFixed(2)`).

### 3.4 `centroid(points: Pt[]): Pt` — moyenne arithmetique.

### 3.5 `layerDuration(key: LayerKey): string`
- `top` → `'0 – 15 min'` ; `heart` → `'15 min – 2 h'` ; `base` → `'2 h et +'`.
- **Tirets cadratins** (`–` U+2013), pas des traits d'union.

### 3.6 `layerAphorism(key: LayerKey | null): string`
- `top` → `'L'éclat des premières minutes'` ; `heart` → `'Le cœur qui porte'` ; `base` → `'La trace qui reste'` ; `null` → `'Le parfum, heure par heure'`.

### 3.7 `layerContextLabel(key: LayerKey): string`
- `top` → `'Note de tête'` ; `heart` → `'Note de cœur'` ; `base` → `'Note de fond'`.

### 3.8 `pickInitialLayer(top: number, heart: number, base: number): LayerKey`
- Comptes de notes. Retourne la strate au compte maximal ; **egalite → `'heart'`** ; toutes a zero → `'heart'`.

---

## 4. `src/features/catalog/pyramid/PyramidStage.tsx` — spec exacte

### 4.1 Props

```ts
interface LayerDef {
  key: LayerKey;
  label: string;        // 'Tête' | 'Cœur' | 'Fond'
  notes: string[];
  color: string;        // theme.colors.pyramidXxx
  soft: string;         // theme.colors.pyramidXxxSoft
  ink: string;          // theme.colors.pyramidXxxInk
}

interface Props {
  layers: [LayerDef, LayerDef, LayerDef];   // ordre top, heart, base
  active: LayerKey | null;
  onSelect: (key: LayerKey) => void;
  resolvedMode: 'light' | 'dark';
  borderColor: string;                       // theme.colors.border (hairlines temps)
  textMuted: string;                         // theme.colors.textMuted
}
```

### 4.2 Dimensions (constantes derivees de `useWindowDimensions`)

```
screenW  = useWindowDimensions().width
SVG_W    = min(250, screenW - 200)
SVG_H    = round(SVG_W * 0.92)
BH       = SVG_H / 3
CX       = SVG_W / 2
GAP      = 3
LABEL_W  = 68      // colonne gauche
TIME_W   = 72      // colonne droite
ROW_H    = max(BH, 64)
STAGE_W  = LABEL_W + 10 + SVG_W + 10 + TIME_W
STAGE_H  = 3 * ROW_H   // SVG centre verticalement si ROW_H > BH
```

### 4.3 Structure de rendu

```
<View style={s.root}>                                    // width STAGE_W, alignSelf 'center'
  {layers.map((layer, k) => (
    <Pressable                                           // UNE rangee = UNE cible tactile
      key={layer.key}
      onPress={() => onSelect(layer.key)}
      accessibilityRole="button"
      accessibilityLabel={`Notes de ${layer.label.toLowerCase()}, ${layer.notes.length} notes`}
      accessibilityState={{ selected: active === layer.key }}
      style={{ height: ROW_H, flexDirection: 'row', alignItems: 'center' }}
      android_ripple={undefined}                          // pas de ripple — le crossfade suffit
    >
      {/* Colonne label (gauche) */}
      <View style={{ width: LABEL_W, alignItems: 'flex-end', paddingRight: 10 }}>
        <Text style={labelStyle(layer, k)}>{layer.label}</Text>
        <View style={countBadgeStyle(layer)}>
          <Text allowFontScaling={false} style={countTextStyle(layer)}>{layer.notes.length}</Text>
        </View>
      </View>

      {/* Zone SVG (centre) — seule la rangee k=0 porte le Svg absolu plein cadre */}
      <View style={{ width: SVG_W, height: ROW_H }} />

      {/* Colonne temps (droite) */}
      <View style={{ width: TIME_W, flexDirection: 'row', alignItems: 'center', paddingLeft: 10, gap: 6 }}>
        <View style={{ width: 12, height: StyleSheet.hairlineWidth, backgroundColor: borderColor }} />
        <Text allowFontScaling={false} style={s.timeText}>{layerDuration(layer.key)}</Text>
      </View>
    </Pressable>
  ))}

  {/* Svg superpose, non interactif */}
  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
    <Svg width={SVG_W} height={SVG_H}> … </Svg>
  </View>
</View>
```

> Le `Svg` est rendu en `absoluteFill` au-dessus des rangees (dernier dans l'ordre de rendu) avec `pointerEvents="none"` : les Pressables recoivent tous les touches. **Supprimer definitivement l'ancien hit-test `locationX/locationY`.**

### 4.4 Contenu du Svg (ordre de rendu strict)

```tsx
<Svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
  <Defs>
    {/* Un gradient diagonal par strate : couleur → assombrie 12% (light) / eclaircie 8% (dark) */}
    {layers.map(l => (
      <LinearGradient key={`grad-${l.key}`} id={`grad-${l.key}`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={l.color} stopOpacity="1" />
        <Stop offset="1" stopColor={shade(l.color, resolvedMode === 'light' ? -0.12 : 0.08)} stopOpacity="1" />
      </LinearGradient>
    ))}
    {/* Texture gravure : hairlines diagonales 5% (§4.12) */}
    {layers.map(l => (
      <Pattern key={`hatch-${l.key}`} id={`hatch-${l.key}`} patternUnits="userSpaceOnUse"
               width="6" height="6" patternTransform="rotate(45)">
        <Line x1="0" y1="0" x2="0" y2="6" stroke={shade(l.color, -0.4)} strokeWidth="1" opacity="0.05" />
      </Pattern>
    ))}
    {/* Halo radial par strate */}
    {layers.map(l => (
      <RadialGradient key={`halo-${l.key}`} id={`halo-${l.key}`} cx="50%" cy="50%" rx="50%" ry="50%">
        <Stop offset="0" stopColor={l.color} stopOpacity="0.35" />
        <Stop offset="1" stopColor={l.color} stopOpacity="0" />
      </RadialGradient>
    ))}
  </Defs>

  {/* Pour chaque strate k : halo (si active) + bande soft + bande gradient + texture */}
  {layers.map((l, k) => {
    const { svg, centroid } = bandPoly(SVG_W, SVG_H, k as 0|1|2, GAP);
    const midY = (k + 0.5) * BH;
    const haloRx = (SVG_W / 2) * ((midY) / SVG_H) * 1.5 + 12;
    return (
      <G key={l.key}>
        <AnimatedEllipse
          cx={CX} cy={midY} rx={haloRx} ry={BH * 0.65}
          fill={`url(#halo-${l.key})`}
          animatedProps={haloProps[k]}
        />
        <AnimatedG animatedProps={scaleProps[k]}>
          <AnimatedPolygon points={svg} fill={l.soft} animatedProps={softProps[k]} />
          <AnimatedPolygon points={svg} fill={`url(#grad-${l.key})`} animatedProps={gradProps[k]} />
          <Polygon points={svg} fill={`url(#hatch-${l.key})`} opacity={0.9} />
        </AnimatedG>
      </G>
    );
  })}

  {/* Particule sillage — AU-DESSUS des bandes, fill invariant #FFFFFF */}
  <AnimatedCircle cx={CX} r={3} fill="#FFFFFF" animatedProps={particleProps} />
</Svg>
```

avec, en tete de fichier :

```ts
const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedCircle  = Animated.createAnimatedComponent(Circle);
const AnimatedG       = Animated.createAnimatedComponent(G);
```

### 4.5 SharedValues et animatedProps (tous crees dans PyramidStage)

| SharedValue | Init | Comportement |
|---|---|---|
| `emph[k]` (par strate) | selon `active` initial : 1 si active, 0 sinon | `withTiming(cible, { duration: 280 })` a chaque changement d'`active`. Cible : `active === key ? 1 : active === null ? 0 : -1` |
| `glowO` | 0 | Quand une strate devient active : `withSequence(withTiming(0.25,{duration:0}), withRepeat(withTiming(peak,{duration:1200,easing:Easing.inOut(Easing.ease)}),3,true), withTiming(stable,{duration:300}))`. Quand desactivee : `withTiming(0,{duration:200})`. `peak = 0.45` light / `0.35` dark ; `stable = 0.4` light / `0.32` dark (§4.14 caps) |
| `entry[k]` | 0 | `withDelay(k*120, withTiming(1, { duration: 350 }))` au mount |
| `particleY` | 0 | `withRepeat(withTiming(SVG_H, { duration: 5500, easing: Easing.inOut(Easing.quad) }), -1, false)` au mount ; `cancelAnimation(particleY)` au cleanup |

Derivations (`useAnimatedProps`) :

```ts
gradProps[k]  = () => ({ opacity: entry[k].value * interpolate(emph[k].value, [-1, 0, 1], [0, 0.92, 1]) })
softProps[k]  = () => ({ opacity: entry[k].value * interpolate(emph[k].value, [-1, 0, 1], [0.5, 0, 0]) })
scaleProps[k] = () => {
  const s = interpolate(emph[k].value, [0, 1], [1, 1.03]);
  const midY = (k + 0.5) * BH;   // constante, precalculee
  return { transform: `translate(${CX} ${midY}) scale(${s}) translate(${-CX} ${-midY})` };
};
haloProps[k]  = () => ({ opacity: active_k ? glowO.value : 0 })
// haloProps : seule la strate active consomme glowO ; les autres 0.
particleProps = () => ({
  cy: particleY.value,
  opacity: interpolate(particleY.value, [0, SVG_H*0.15, SVG_H*0.85, SVG_H], [0, 0.55, 0.55, 0]),
});
```

`useEffect([active])` : met a jour les `emph[k]` et `glowO`. `useEffect([])` mount : entry + particle + cleanup `cancelAnimation`.

### 4.6 Styles exacts (dans `getStyles(t: Theme)`)

```ts
root:      { alignItems: 'center', alignSelf: 'center' },
timeText:  { fontFamily: 'Inter_400Regular', fontSize: 10, color: /* textMuted via prop */, fontVariant: ['tabular-nums'] },
// Label strate (§3.2 label signature) :
labelBase:   { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 16, color: textMuted },
labelActive: { color: layer.ink },
// Pastille compteur :
countBadge:  { marginTop: 3, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
               backgroundColor: layer.soft, alignItems: 'center', justifyContent: 'center' },
countText:   { fontFamily: 'Inter_700Bold', fontSize: 11, color: layer.ink },
```

`labelStyle(layer, k)` : `active === layer.key ? [s.labelBase, { color: layer.ink }] : s.labelBase`.

---

## 5. `src/features/catalog/pyramid/NoteCloud.tsx` — spec exacte

### 5.1 Props

```ts
interface Props {
  layer: LayerDef | null;
  onNotePress: (note: string, layer: LayerKey) => void;
}
```

### 5.2 Rendu

- `layer === null` → `return null` (aucun placeholder, aucune hauteur reservee).
- Strate sans notes → un seul `<Text>` : `fontFamily: 'Inter_400Regular'`, `fontSize: 13`, `fontStyle: 'italic'`, `color: layer.ink`, contenu `` `Aucune note de ${layer.label.toLowerCase()} renseignée` ``.
- Sinon : container `{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 }`.

### 5.3 Pétale (§4.13) — sous-composant interne `NotePetal`

```tsx
<Animated.View
  key={`${layer.key}-${note}-${i}`}              // key inclut layer.key → re-trigger a chaque changement
  entering={FadeInDown.delay(i * 55).duration(220).springify()}
>
  <Pressable
    onPress={() => { hapticsLight(); onNotePress(note, layer.key); }}
    hitSlop={{ top: 4, bottom: 4 }}
    accessibilityRole="button"
    accessibilityLabel={`Note ${translateNote(note)}`}
    style={({ pressed }) => [
      {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1,
        backgroundColor: layer.soft,
        borderColor: alpha(layer.color, 0.35),
      },
      pressed && { transform: [{ scale: 0.95 }], opacity: 0.8 },
    ]}
  >
    <Text style={{ fontSize: 13 }}>{getNoteEmoji(note)}</Text>
    <Text maxFontSizeMultiplier={1.3} style={{
      fontFamily: 'Inter_500Medium', fontSize: 13, color: layer.ink,
    }}>
      {translateNote(note)}
    </Text>
  </Pressable>
</Animated.View>
```

---

## 6. `src/features/catalog/OlfactoryPyramid.tsx` — spec exacte

### 6.1 Props (retrocompatible)

```ts
interface Props {
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  onNotePress?: (note: string, layer?: LayerKey) => void;
}
```

### 6.2 Etat et composition

```ts
const [active, setActive] = useState<LayerKey | null>(() =>
  pickInitialLayer(topNotes.length, heartNotes.length, baseNotes.length));
```

- `layers` construit via `useMemo` (tokens `c.pyramidTop/Heart/Base` + `…Soft` + `…Ink`).
- `hasAnyNotes === false` → `return null` (conserve).
- `handleSelect = useCallback((key: LayerKey) => { hapticsLight(); setActive(prev => prev === key ? null : key); }, [])`.
- `handleNotePress = useCallback((note: string, layer: LayerKey) => onNotePress?.(note, layer), [onNotePress])`.

### 6.3 Structure

```
<Animated.View style={s.root} entering={FadeIn.duration(400)}>
  {/* Voile ambiant (§4.14) — absolu, derriere tout, bleed */}
  <View pointerEvents="none" style={s.veilWrap}>
    <Svg width={veilW} height={veilH}>
      <Defs>… 3 RadialGradient voile-top/heart/base …</Defs>
      <AnimatedEllipse … fill={url(#veil-prev)} animatedProps={veilPrevProps} />
      <AnimatedEllipse … fill={url(#veil-next)} animatedProps={veilNextProps} />
    </Svg>
  </View>

  {/* Header §4.9 + ligne editoriale */}
  <View style={s.header}>
    <View style={s.headerRow}>
      <View style={s.headerBadge}>
        <Ionicons name="layers-outline" size={14} color={c.primary} />
      </View>
      <Text style={s.title}>Pyramide olfactive</Text>
    </View>
    <View style={s.aphorismSlot}>
      <Animated.Text key={active ?? 'none'} entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)}
                     style={[s.aphorism, active && { color: activeInk }]}>
        {layerAphorism(active)}
      </Animated.Text>
    </View>
  </View>

  <PyramidStage layers={layers} active={active} onSelect={handleSelect}
                resolvedMode={resolvedMode} borderColor={c.border} textMuted={c.textMuted} />

  <NoteCloud layer={activeLayer ?? null} onNotePress={handleNotePress} />
</Animated.View>
```

### 6.4 Voile ambiant — valeurs figes

- `veilWrap` : `{ position: 'absolute', top: 56, left: -16, right: -16, height: veilH, alignItems: 'center' }` avec `veilH = SVG_H + 120` (recalculer la meme geometrie que le stage via `useWindowDimensions`).
- `veilW = screenW - 32 + 32 = screenW` (bleed du padding 16 de la section, pleine largeur de `contentWrap`).
- Ellipse : `cx = veilW / 2`, `cy = SVG_H * 0.55`, `rx = veilW * 0.7`, `ry = SVG_H * 0.75`.
- Gradient : `<Stop offset="0" stopColor={layerColor} stopOpacity={resolvedMode === 'light' ? 0.12 : 0.14} />` → `<Stop offset="1" stopOpacity={0} />`.
- **Crossfade** : deux SharedValues `veilPrevO`/`veilNextO`. Au changement d'`active` : la couleur « next » devient celle de la nouvelle strate, `veilNextO.value = withTiming(masterO, { duration: 300 })`, `veilPrevO.value = withTiming(0, { duration: 300 })`, puis swap des roles (etat React `veilColors` en `useState`/`useEffect`, pattern standard de crossfade a 2 couches). `masterO = 0.5` light / `0.35` dark. **`active === null` → `masterO = 0`** (le voile s'eteint).
- Interdiction : animer les `<Stop>` — le crossfade se fait uniquement via l'opacite des deux `<AnimatedEllipse>`.

### 6.5 Styles exacts

```ts
root:         { marginTop: 24, marginBottom: 4 },
header:       { marginBottom: 18 },
headerRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
headerBadge:  { width: 28, height: 28, borderRadius: 14, backgroundColor: c.primarySoft,
                alignItems: 'center', justifyContent: 'center' },
title:        { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, color: c.text },
aphorismSlot: { height: 22, marginTop: 6, marginLeft: 36, justifyContent: 'center' },
aphorism:     { fontFamily: 'PlayfairDisplay_700Bold_Italic', fontSize: 15, color: c.textMuted },
```

> `aphorismSlot` a une **hauteur fixe 22** : le crossfade ne provoque aucun saut de layout.

---

## 7. `src/components/NoteDetailPopup.tsx` — modifications

### 7.1 Props

```ts
interface Props {
  visible: boolean;
  noteName: string;
  layer?: 'top' | 'heart' | 'base' | null;   // NOUVEAU — optionnel, defaut null
  onClose: () => void;
}
```

### 7.2 Changements visuels (tout le reste conserve : animations opacity/scale 250 ms, backdrop, close 32 px)

Lookup interne via `useTheme()` :
```ts
const layerColors = layer ? {
  color: c[`pyramid${cap(layer)}`], soft: c[`pyramid${cap(layer)}Soft`], ink: c[`pyramid${cap(layer)}Ink`],
} : null;
```
(utiliser un mapping explicite typé, pas d'acces dynamique non type.)

1. **Cercle emoji** : `backgroundColor: layerColors?.soft ?? c.primarySoft`.
2. **Chip contexte** (nouveau, sous `noteName`, `marginBottom: 10`) : row centre `gap: 6` — dot 6×6 `borderRadius: 3` `backgroundColor: layerColors.color` + `<Text>` `Inter_500Medium` 11 `color: layerColors.ink`, contenu `layerContextLabel(layer)`. Rendu seulement si `layer`.
3. **Ligne duree** (nouvelle, sous le chip, `marginBottom: 12`) : row centre `gap: 5` — `Ionicons name="time-outline" size={12} color={c.textMuted}` + `<Text allowFontScaling={false}>` `Inter_400Regular` 12 `color: c.textMuted` `fontVariant: ['tabular-nums']`, contenu `` `Perceptible : ${layerDuration(layer)}` ``. Rendu seulement si `layer`.
4. **Bordure carte** : `borderWidth: layer ? 1 : 0`, `borderColor: layer ? alpha(layerColors.color, 0.25) : 'transparent'`.

Import de `layerDuration`/`layerContextLabel`/`alpha` depuis `../features/catalog/pyramid/geometry` (acceptable) **ou** deplacer ces 3 helpers dans `src/utils/` si un lint d'import croise gene — choisir l'import direct, sans deplacement.

---

## 8. `app/catalog/[id].tsx` — diff exact (3 lignes)

**Ligne 183**, avant :
```ts
const [selectedNote, setSelectedNote] = useState<string | null>(null);
```
apres :
```ts
const [selectedNote, setSelectedNote] = useState<{ name: string; layer: 'top' | 'heart' | 'base' | null } | null>(null);
```

**Lignes 560–565**, avant :
```tsx
<OlfactoryPyramid
  topNotes={parfum.notesTete}
  heartNotes={parfum.notesCoeur}
  baseNotes={parfum.notesFond}
  onNotePress={setSelectedNote}
/>
```
apres :
```tsx
<OlfactoryPyramid
  topNotes={parfum.notesTete}
  heartNotes={parfum.notesCoeur}
  baseNotes={parfum.notesFond}
  onNotePress={(note, layer) => setSelectedNote({ name: note, layer: layer ?? null })}
/>
```

**Lignes 701–705**, avant :
```tsx
<NoteDetailPopup
  visible={selectedNote !== null}
  noteName={selectedNote ?? ''}
  onClose={() => setSelectedNote(null)}
/>
```
apres :
```tsx
<NoteDetailPopup
  visible={selectedNote !== null}
  noteName={selectedNote?.name ?? ''}
  layer={selectedNote?.layer ?? null}
  onClose={() => setSelectedNote(null)}
/>
```

---

## 9. Tokens utilises (aucun nouveau token — ne PAS modifier `theme.ts`)

| Usage | Token |
|---|---|
| Strate tete / coeur / fond | `pyramidTop` / `pyramidHeart` / `pyramidBase` |
| Fonds petale, pastille compteur, cercle emoji popup | `pyramidXxxSoft` |
| Texte petale, label actif, chip popup, compteur | `pyramidXxxInk` |
| Badge header | `primarySoft` + icone `primary` |
| Hairlines temps | `border` |
| Aphorisme repos, annotations temps | `textMuted` |
| Particule sillage | `#FFFFFF` (invariante §2.3) |

---

## 10. Accessibilite — labels litteraux

| Element | role | label |
|---|---|---|
| Rangee strate | `button` | `` `Notes de ${label.toLowerCase()}, ${notes.length} notes` `` + `accessibilityState={{ selected }}` |
| Petale | `button` | `` `Note ${translateNote(note)}` `` |
| Close popup | `button` | `'Fermer le détail de la note'` (existant, conserver) |

`allowFontScaling={false}` : compteurs, annotations temps, ligne duree popup. `maxFontSizeMultiplier={1.3}` : noms de notes, description popup.

---

## 11. `__tests__/pyramid-geometry.test.ts` — cas obligatoires

1. `bandPoly(w=240, h=220, k=0, gap=3)` : 4 sommets, sommets 1 et 2 confondus (triangle), `svg` matche `/^[\d.,\- ]+$/` avec 4 paires.
2. Inset : pour k=1, chaque sommet inset est **strictement plus proche** du centroide que le sommet brut (`gap=3` > 0).
3. `centroid` d'un carre `(0,0)(10,0)(10,10)(0,10)` → `{ x: 5, y: 5 }`.
4. `shade('#6C3ED9', -0.12)` : chaque canal reduit, format `#RRGGBB` uppercase.
5. `shade('#0D9488', 0.08)` : eclaircit, clamp a 255 (tester `shade('#FFFFFF', 0.5)` → `'#FFFFFF'`).
6. `shade('#000000', -0.5)` → `'#000000'`.
7. `alpha('#C8945A', 0.35)` → `'rgba(200,148,90,0.35)'`.
8. `layerDuration` : 3 valeurs exactes avec tirets cadratins U+2013.
9. `layerAphorism` : 3 strates + `null` → `'Le parfum, heure par heure'`.
10. `layerContextLabel` : 3 valeurs exactes.
11. `pickInitialLayer` : `(2, 5, 3)` → `'heart'` ; `(6, 5, 3)` → `'top'` ; `(2, 2, 2)` → `'heart'` ; `(0, 0, 0)` → `'heart'`.

Suite totale attendue : 204 → **~215 tests**.

---

## 12. Ordre d'implementation (8 etapes, verification apres chacune)

1. **`geometry.ts` + tests** → `npx jest pyramid-geometry --ci` vert.
2. **`PyramidStage.tsx` statique** (bandes + gradients + hatch + labels + temps, `emph` fixes, pas d'animation) → `npx tsc --noEmit` 0 erreur ; build visuel OK sur emulateur.
3. **Interactions strates** : `emph`, crossfades, scale spring, `handleSelect` → tap fonctionnel, dark mode OK.
4. **`NoteCloud.tsx` + petales** → staggered OK, popup s'ouvre avec la bonne note.
5. **Animations ambiantes** : particule (boucle infinie), halo borne x3, entree staggered → verifier qu'il n'y a **qu'une** boucle infinie et les `cancelAnimation`.
6. **Voile ambiant** dans `OlfactoryPyramid.tsx` → crossfade teal→dore→violet fluide, `active null` → eteint.
7. **Popup v2 + `[id].tsx`** (§7, §8) → chip contexte + duree visibles.
8. **Finitions** : accessibilite, texte agrandi max, dark mode complet, `npx tsc --noEmit`, `npx jest --ci`, mise a jour `rules.md` §2 + `reference.md` §6 (v5 → v7).

---

## 13. Criteres d'acceptation finaux (tous obligatoires)

- [ ] `npx tsc --noEmit` : 0 erreur.
- [ ] `npx jest --ci` : vert, ~215 tests.
- [ ] Aucun `fontWeight`, aucun `any`, aucune couleur en dur hors `#FFFFFF` (particule).
- [ ] Aucun `Svg.Text` (labels en overlay RN).
- [ ] Aucune animation de `<Stop>`.
- [ ] Exactement **1** `withRepeat(-1)` dans toute la section (la particule).
- [ ] Rangees tactiles >= 64 px ; petale avec `hitSlop`.
- [ ] Aphorisme : italique uniquement ici, aucune autre ligne ajoutee ailleurs sur la fiche.
- [ ] Dark mode : petal borders visibles, voile <= 0.35, halo <= 0.35, aucun flash blanc.
- [ ] Texte agrandi (reglages max) : pas de debordement sur labels, compteurs, temps.
- [ ] `hasAnyNotes === false` → section absente, aucun espace vide.
- [ ] Strate vide : message italique, pas de crash.

---

## 14. Interdits explicites

1. Ne pas modifier `theme.ts` (aucun nouveau token).
2. Ne pas toucher a `translate-note.ts` / `note-descriptions.ts`.
3. Ne pas reintroduire le hit-test mathematique `locationX/locationY`.
4. Ne pas utiliser `StyleSheet.create` pour du style thematique.
5. Ne pas ajouter de seconde boucle infinie (respiration, pulsation…) — §7.5.
6. Ne pas ajouter d'italique hors de l'aphorisme.
7. Ne pas changer les props publiques d'`OlfactoryPyramid` au-dela de l'ajout optionnel de `layer`.
8. Ne pas deplacer/renommer `OlfactoryPyramid.tsx` (import de `[id].tsx` inchange).

---

## 15. Correction par rapport aux plans anterieurs (a appliquer, ne pas en discuter)

La **particule sillage est rendue AU-DESSUS des polygones** (dernier element du `<Svg>`), contrairement a une version precedente qui la plaçait dessous — dessous, elle serait invisible. Opacite plafonnee a 0.55 pour rester subliminale.
