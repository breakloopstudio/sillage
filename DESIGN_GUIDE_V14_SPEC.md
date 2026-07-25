# SPECIFICATION — Design Guide v1.4 (échelle d'opacité, copy, iconographie)

> **Destinataire** : agent d'implémentation (DeepSeek V4 Pro).
> **Projet** : ParfumScan React — `C:\dev\ParfumScan_react`.
> **Mission** : faire passer `.clinerules/design-guide.md` de v1.3 à v1.4 en ajoutant trois sections normatives (Phase A), puis aligner 4 valeurs d'opacité dans le code (Phase B).
> **Regle absolue** : ce document est un contrat. Les textes à insérer sont fournis **complets et définitifs** — les reproduire tels quels, en respectant les ancres d'insertion. Toute impossibilité technique doit etre signalee plutot qu'improvisee.

---

## 0. Regles non negociables

1. **Phase A** : seul `.clinerules/design-guide.md` est modifie. Aucune renumérotation des sections existantes, aucune reecriture des patterns existants, aucun nouveau token couleur.
2. **Phase B** : 4 edits chirurgicaux dans 3 fichiers listes §6. Aucun autre fichier touche. **Ne pas** modifier les valeurs du halo (`stopOpacity`, `peak`, `stable`, `breathLow`) ni du voile ambiant — elles sont calees visuellement et couvertes par la regle de tolerance (§2.5 du guide).
3. Le guide est en francais, style terse, tables markdown. Respecter cette voix.
4. Les ancres d'insertion sont citees **exactement** telles qu'elles existent dans le fichier. Si une ancre est introuvable, s'arreter et signaler.
5. Apres Phase B : `npx tsc --noEmit` 0 erreur, `npx jest --ci` 227 tests verts.

---

## 1. Ligne de version (remplacement)

Chercher (ligne 4, avec ses deux espaces finales) :

```
**Version** : 1.3 — Juillet 2026 (planche annotée, pétales de note, voile ambiant, label signature, chiffres tabulaires, budget d'animations ambiantes)  
```

Remplacer par :

```
**Version** : 1.4 — Juillet 2026 (échelle d'opacité sémantique, copy & voix éditoriale, iconographie)  
```

---

## 2. Insertion §2.5 — Échelle d'opacité sémantique

**Ancre** : le bloc suivant (fin du §2.4, debut du §3) —

```
- ❌ Du violet et du doré côte à côte comme couleurs d'action

---

## 3. Règles typographiques
```

**Inserer entre `- ❌ Du violet...` et `---`, en conservant le `---` et le titre `## 3.`** :

```markdown
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
- Helper obligatoire : `alpha(hex, palier)` — pas de `rgba()` manuel hors §2.3.
```

---

## 3. Insertion §3.6 — Copy & voix éditoriale

**Ancre** : le bloc suivant (fin du §3.5, debut du §4) —

```
Ne jamais appliquer sur Playfair (ses chiffres elzeviriens sont voulus).

---

## 4. Patterns UI récurrents
```

**Inserer entre `Ne jamais appliquer...` et `---`, en conservant le `---` et le titre `## 4.`** :

```markdown
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
```

---

## 4. Insertion §4.15 — Iconographie

**Ancre** : le bloc suivant (fin du §4.14, debut du §5) —

```
Maximum **un** voile par écran.

---

### 5.1 Grille de spacing
```

**Inserer entre `Maximum **un** voile par écran.` et `---`, en conservant le `---` et le titre `### 5.1`** :

```markdown
### 4.15 Iconographie (Ionicons)

Une seule famille : `@react-native-vector-icons/ionicons`. Quatre tailles, un style.

| Taille | Contexte |
|---|---|
| 14 | Pastilles de titre de section (§4.9), chips |
| 16 | Inline avec texte 13–14 (durées, métadonnées) |
| 20 | Boutons, rows de liste, onglets |
| 32 | Empty states (cercle 72 × 72) |

- **Outline partout** (suffixe `-outline`), deux exceptions filled : cœur favori actif, étoiles de rating.
- Couleur : `textMuted` par défaut ; `xxxInk` dans une pastille `xxxSoft` ; `#FFFFFF` (§2.3) sur bouton ou FAB plein. `primary` seul uniquement si l'icône EST l'action.
- Cohérence sémantique : `time-outline` = temporalité, `flask` = parfumerie, `layers-outline` = structure olfactive, `color-filter-outline` = accords. Ne pas introduire une seconde métaphore pour un concept déjà pourvu.
- Aucun emoji en remplacement d'une icône UI (les emojis de catégories olfactives restent confinés aux pétales §4.13 et au popup note).
```

---

## 5. Annexe B — 3 lignes checklist

**Ancre** (checklist « Nouveau composant », ligne existante) :

```
- [ ] Boucles infinies → 1 max/écran, autres bornées ≤ 4 répétitions (§7.5)
```

**Inserer immediatement apres cette ligne** :

```
- [ ] Transparences → paliers §2.5 (`alpha()` + palier, dark lumineux ÷2, structure inchangé)
- [ ] Icônes → tailles §4.15 (14/16/20/32), outline, couleur selon contexte
- [ ] Copy → tutoiement, cadratin `–`, `·`, pas de « ! », ligne éditoriale ≤ 6 mots à métaphore sensorielle
```

---

## 6. Phase B — Alignement code (4 edits, obligatoires)

### 6.1 `src/features/catalog/pyramid/NoteCloud.tsx`

Chercher :
```ts
borderColor: alpha(layer.color, 0.35),
```
Remplacer par (palier `veil`) :
```ts
borderColor: alpha(layer.color, 0.24),
```

### 6.2 `src/components/NoteDetailPopup.tsx`

Chercher :
```ts
layerColors ? { borderWidth: 1, borderColor: alpha(layerColors.color, 0.25) } : null
```
Remplacer par (palier `veil`) :
```ts
layerColors ? { borderWidth: 1, borderColor: alpha(layerColors.color, 0.24) } : null
```

### 6.3 `src/features/catalog/pyramid/PyramidStage.tsx` — texture gravure (palier `ghost`)

Chercher :
```tsx
<Line x1="0" y1="0" x2="0" y2="6" stroke={shade(l.color, -0.4)} strokeWidth="1" opacity="0.05" />
```
Remplacer par :
```tsx
<Line x1="0" y1="0" x2="0" y2="6" stroke={shade(l.color, -0.4)} strokeWidth="1" opacity="0.08" />
```

### 6.4 `src/features/catalog/pyramid/PyramidStage.tsx` — bande inactive (palier `dim`)

Chercher (3 occurrences, `emph0`, `emph1`, `emph2`) :
```ts
useAnimatedProps(() => ({ opacity: entry0.value * interpolate(emph0.value, [-1, 0, 1], [0.5, 0, 0]) })),
```
Remplacer dans les 3 `softProps` la plage `[0.5, 0, 0]` par `[0.4, 0, 0]` (garder `emph0`/`emph1`/`emph2` respectifs) :
```ts
useAnimatedProps(() => ({ opacity: entry0.value * interpolate(emph0.value, [-1, 0, 1], [0.4, 0, 0]) })),
```

**Ne pas toucher** : `stopOpacity` du halo (0.35/0.12), `peak`/`stable`/`breathLow`, stopOpacity du voile ambiant (0.12/0.14) — valeurs calees, tolerance §2.5.

---

## 7. Criteres d'acceptation

- [ ] `design-guide.md` : version 1.4 en ligne 4 ; §2.5, §3.6, §4.15 presentes aux bons endroits ; 3 lignes Annexe B ajoutees ; **aucune** section existante modifiee ou renumérotee.
- [ ] Le markdown des nouvelles sections est strictement identique a celui de ce document (accents, tables, punctuation).
- [ ] Phase B : exactement 6 lignes modifiees au total (1 dans `NoteCloud.tsx`, 1 dans `NoteDetailPopup.tsx`, 1 hatch + 3 softProps dans `PyramidStage.tsx`), aucun autre diff.
- [ ] `npx tsc --noEmit` : 0 erreur.
- [ ] `npx jest --ci` : 227 tests verts, 17 suites.
- [ ] `git diff --stat` : 4 fichiers modifies au total (`design-guide.md`, `NoteCloud.tsx`, `NoteDetailPopup.tsx`, `PyramidStage.tsx`).

---

## 8. Interdits

1. Ne pas renuméroter les sections existantes (les renvois §4.12/§4.13/§4.14 dans le guide et le code doivent rester valides).
2. Ne pas « ameliorer » les textes fournis — ils sont definitifs.
3. Ne pas toucher `theme.ts`, ni ajouter de tokens.
4. Ne pas aligner d'autres valeurs d'opacite que les 4 de la Phase B (le reste est grand-père, tolerance ±4).
5. Ne pas toucher aux valeurs halo/voile (calees visuellement).
6. Ne pas modifier la partie « Révision design » de l'Annexe B (seulement « Nouveau composant »).
