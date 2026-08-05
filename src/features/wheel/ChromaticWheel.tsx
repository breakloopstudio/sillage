// src/features/wheel/ChromaticWheel.tsx — Roue chromatique v2 (disque plein)
// Disque colorimétrique façon roue Figma : 240 wedges SVG remplis (teinte par
// angle) + overlay RadialGradient blanc (centre désaturé → bord saturé), rendus
// 1× et mémoïsés (zéro re-render, zéro coût par frame). 12 ancres équidistantes
// de 30° (dots bordés de blanc) + 4 neutres en grille 2×2 au centre.
// Geste 100 % UI thread (Pan worklet + atan2, pattern Runner/DockBar) ; JS
// réveillé uniquement sur événements discrets (franchissement d'ancre, commit).
// ONE-TAP : tout commit (tap dot/anneau/pastille, fin de drag) notifie le
// parent qui navigue immédiatement vers /search?color=<key>.
// A11y (§6.8) : 16 cibles verbalisées (12 dots + 4 pastilles), info
// couleur-seule doublée de texte ; le conteneur ne porte pas de rôle adjustable
// (le flux one-tap rendrait increment/decrement inutilisable).

import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, useDerivedValue, useAnimatedReaction,
  withTiming, runOnJS, interpolateColor, cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import {
  RING_ANCHORS, CENTER_NEUTRALS, chromaSwatch,
  hsvToHex, type ChromaticKey,
} from '../../utils/chromatic-wheel';

// ─── Géométrie (constantes pures, précalculées au scope module) ──────────────

const SIZE = 300;
const CENTER = SIZE / 2;
const DISC_R = 140;
const DOT_ORBIT = DISC_R - 14;
const THUMB = 30;
const PAD = 44;
const PAD_GAP = 8;
const PAD_OFFSET = (PAD + PAD_GAP) / 2;
const PAD_HIT_R = PAD / 2 + 8;
const DEAD_R = 70;

const DEG = Math.PI / 180;

function pointAt(deg: number, radius: number): { x: number; y: number } {
  const a = (deg - 90) * DEG;
  return { x: CENTER + Math.cos(a) * radius, y: CENTER + Math.sin(a) * radius };
}

// Disque plein : wedges remplis, chevauchement +0,6° anti-coutures AA.
const WEDGES = (() => {
  const out: { d: string; color: string }[] = [];
  const N = 240;
  const step = 360 / N;
  for (let i = 0; i < N; i++) {
    const p0 = pointAt(i * step, DISC_R);
    const p1 = pointAt((i + 1) * step + 0.6, DISC_R);
    out.push({
      d: `M ${CENTER} ${CENTER} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${DISC_R} ${DISC_R} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`,
      color: hsvToHex(i * step, 0.9, 0.96),
    });
  }
  return out;
})();

// Couleurs du spectre pour interpolateColor (thumb), accordées au disque.
const SPECTRUM_STOPS = [0, 60, 120, 180, 240, 300, 360];
const SPECTRUM_COLORS = SPECTRUM_STOPS.map(h => hsvToHex(h, 0.9, 0.96));

// Ancres de l'anneau (12 hues équidistantes) + positions des dots.
const ANCHOR_HUES = RING_ANCHORS.map(a => a.hue ?? 0);
const ANCHOR_KEYS = RING_ANCHORS.map(a => a.key);
const ANCHOR_DOTS = RING_ANCHORS.map(a => ({
  key: a.key,
  ...pointAt(a.hue ?? 0, DOT_ORBIT),
  color: chromaSwatch(a.key, 'light').swatch,
}));

// Neutres au centre : grille 2×2 (noir HG, blanc HD, gris BG, brun BD).
const PAD_CENTERS = [
  { x: CENTER - PAD_OFFSET, y: CENTER - PAD_OFFSET },
  { x: CENTER + PAD_OFFSET, y: CENTER - PAD_OFFSET },
  { x: CENTER - PAD_OFFSET, y: CENTER + PAD_OFFSET },
  { x: CENTER + PAD_OFFSET, y: CENTER + PAD_OFFSET },
];
const PAD_KEYS = CENTER_NEUTRALS.map(c => c.key);

// ─── Helpers worklet-safe (module scope, primitives uniquement) ──────────────
// Miroirs des fonctions pures testées de chromatic-wheel.ts
// (nearestAnchorIndex / hitPadIndex) — garder en phase.

function nearestAnchorIdx(deg: number): number {
  'worklet';
  const h = ((deg % 360) + 360) % 360;
  let best = 0;
  let bestDist = 361;
  for (let i = 0; i < ANCHOR_HUES.length; i++) {
    let d = Math.abs(h - ANCHOR_HUES[i]);
    if (d > 180) d = 360 - d;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function nearestPadIdx(x: number, y: number): number {
  'worklet';
  let best = -1;
  let bestDist = PAD_HIT_R;
  for (let i = 0; i < PAD_CENTERS.length; i++) {
    const d = Math.hypot(x - PAD_CENTERS[i].x, y - PAD_CENTERS[i].y);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

function degFromPoint(x: number, y: number): number {
  'worklet';
  return (Math.atan2(y - CENTER, x - CENTER) / DEG + 90 + 360) % 360;
}

// ─── Disque SVG statique (rendu 1×, mémoïsé — jamais re-rendu) ───────────────

const WheelDisc = memo(function WheelDisc() {
  return (
    <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {/* Désaturation centrale : centre clair → bord saturé (roue Figma).
            stopColor opaque + stopOpacity (jamais rgba dans stopColor —
            l'alpha de stopColor est écrasé par extractGradient). */}
        <RadialGradient id="wheelDesat" cx="50%" cy="50%" r="50%">
          <Stop offset={0} stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset={0.45} stopColor="#FFFFFF" stopOpacity={0.62} />
          <Stop offset={0.78} stopColor="#FFFFFF" stopOpacity={0.18} />
          <Stop offset={1} stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {WEDGES.map((w, i) => (
        <Path key={i} d={w.d} fill={w.color} />
      ))}
      <Circle cx={CENTER} cy={CENTER} r={DISC_R} fill="url(#wheelDesat)" />
      {/* Hairline blanche invariante sur le bord (esprit §2.3) */}
      <Circle cx={CENTER} cy={CENTER} r={DISC_R - 0.5} fill="none" stroke="#FFFFFF" strokeWidth={1} opacity={0.6} />
      {/* Bordure blanche invariante sur élément coloré (esprit §2.3) */}
      {ANCHOR_DOTS.map(dot => (
        <Circle
          key={dot.key}
          cx={dot.x}
          cy={dot.y}
          r={7}
          fill={dot.color}
          stroke="#FFFFFF"
          strokeWidth={2}
        />
      ))}
    </Svg>
  );
});

// ─── Composant principal ─────────────────────────────────────────────────────

interface Props {
  selectedKey: ChromaticKey | null;
  /** Franchissement d'ancre pendant le geste (label live, pas de fetch). */
  onAnchorChange: (key: ChromaticKey) => void;
  /** One-tap : commit (tap ou fin de drag) → le parent navigue. */
  onCommit: (key: ChromaticKey) => void;
  /** Geste relâché hors anneau/pastille (le parent restaure le prompt). */
  onGestureCancel: () => void;
}

export default function ChromaticWheel({ selectedKey, onAnchorChange, onCommit, onGestureCancel }: Props) {
  const { theme, resolvedMode } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation('common');

  // Callbacks stables pour les worklets (latest-ref pattern).
  const anchorChangeRef = useRef(onAnchorChange);
  const commitRef = useRef(onCommit);
  const cancelRef = useRef(onGestureCancel);
  useEffect(() => { anchorChangeRef.current = onAnchorChange; }, [onAnchorChange]);
  useEffect(() => { commitRef.current = onCommit; }, [onCommit]);
  useEffect(() => { cancelRef.current = onGestureCancel; }, [onGestureCancel]);

  const angleDeg = useSharedValue(0);

  const normDeg = useDerivedValue(() => ((angleDeg.value % 360) + 360) % 360);

  const thumbStyle = useAnimatedStyle(() => {
    const a = (normDeg.value - 90) * DEG;
    return {
      transform: [
        { translateX: Math.cos(a) * DOT_ORBIT },
        { translateY: Math.sin(a) * DOT_ORBIT },
      ],
      backgroundColor: interpolateColor(normDeg.value, SPECTRUM_STOPS, SPECTRUM_COLORS),
    };
  });

  // Franchissement d'ancre pendant le drag → JS une fois par ancre (pas par frame).
  const liveIdx = useDerivedValue(() => nearestAnchorIdx(normDeg.value));
  const handleCross = useMemo(() => (idx: number) => {
    const key = ANCHOR_KEYS[idx];
    if (key) anchorChangeRef.current(key);
  }, []);
  useAnimatedReaction(
    () => liveIdx.value,
    (idx, prev) => {
      if (prev !== null && idx !== prev) runOnJS(handleCross)(idx);
    },
  );

  const commitRingIdx = useMemo(() => (idx: number) => {
    const key = ANCHOR_KEYS[idx];
    if (!key) return;
    // Snap visuel vers l'ancre (chemin le plus court) pendant la transition.
    const target = ANCHOR_HUES[idx];
    const cur = angleDeg.value;
    const delta = ((target - cur + 540) % 360) - 180;
    angleDeg.value = withTiming(cur + delta, { duration: 160 });
    commitRef.current(key);
  }, []);

  const commitNeutralIdx = useMemo(() => (idx: number) => {
    const key = PAD_KEYS[idx];
    if (key) commitRef.current(key);
  }, []);

  const notifyCancel = useMemo(() => () => {
    cancelRef.current();
  }, []);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(10)
      .onStart(() => {
        'worklet';
        cancelAnimation(angleDeg);
      })
      .onChange((e) => {
        'worklet';
        const r = Math.hypot(e.x - CENTER, e.y - CENTER);
        if (r < DEAD_R) return;
        angleDeg.value = degFromPoint(e.x, e.y);
      })
      .onEnd((e) => {
        'worklet';
        // Pastilles d'abord (leur hit zone déborde du centre désaturé).
        const pad = nearestPadIdx(e.x, e.y);
        if (pad >= 0) {
          runOnJS(commitNeutralIdx)(pad);
          return;
        }
        const r = Math.hypot(e.x - CENTER, e.y - CENTER);
        if (r >= DEAD_R) {
          runOnJS(commitRingIdx)(nearestAnchorIdx(degFromPoint(e.x, e.y)));
        } else {
          // Relâché dans le centre hors pastille → geste sans commit.
          runOnJS(notifyCancel)();
        }
      });

    const tap = Gesture.Tap()
      .onEnd((e) => {
        'worklet';
        const pad = nearestPadIdx(e.x, e.y);
        if (pad >= 0) {
          runOnJS(commitNeutralIdx)(pad);
          return;
        }
        const r = Math.hypot(e.x - CENTER, e.y - CENTER);
        if (r >= DEAD_R && r <= DISC_R + 26) {
          runOnJS(commitRingIdx)(nearestAnchorIdx(degFromPoint(e.x, e.y)));
        }
      });

    return Gesture.Race(tap, pan);
  }, [commitRingIdx, commitNeutralIdx, notifyCancel]);

  // A11y : activation au lecteur d'écran (le toucher physique passe par le geste).
  const handleDotActivate = useCallback((idx: number) => {
    commitRingIdx(idx);
  }, [commitRingIdx]);
  const handlePadActivate = useCallback((idx: number) => {
    commitNeutralIdx(idx);
  }, [commitNeutralIdx]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={s.wheel}>
        <WheelDisc />

        {/* Cibles a11y des 12 teintes (invisibles, pointerEvents none : le
            toucher physique reste arbitré par le geste parent). */}
        {ANCHOR_DOTS.map((dot, i) => (
          <View
            key={dot.key}
            style={[s.a11yTarget, { left: dot.x - 22, top: dot.y - 22 }]}
            pointerEvents="none"
            accessible
            accessibilityRole="button"
            accessibilityLabel={RING_ANCHORS[i].label}
            accessibilityHint={t('chroma.openA11y')}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={() => handleDotActivate(i)}
          />
        ))}

        {/* Pastilles neutres (réelles, 44 px — cible native §6.2). */}
        {CENTER_NEUTRALS.map((c, i) => {
          const padCenter = PAD_CENTERS[i];
          const swatch = chromaSwatch(c.key, resolvedMode).swatch;
          const active = selectedKey === c.key;
          return (
            <View
              key={c.key}
              style={[
                s.pad,
                {
                  left: padCenter.x - PAD / 2,
                  top: padCenter.y - PAD / 2,
                  backgroundColor: swatch,
                  borderColor: active ? theme.colors.text : theme.colors.border,
                  borderWidth: active ? 2.5 : StyleSheet.hairlineWidth,
                },
              ]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={c.label}
              accessibilityHint={t('chroma.openA11y')}
              accessibilityState={{ selected: active }}
              accessibilityActions={[{ name: 'activate' }]}
              onAccessibilityAction={() => handlePadActivate(i)}
            />
          );
        })}

        {/* Thumb (par-dessus le disque, UI thread). Bordure blanche invariante
            sur élément coloré (esprit §2.3). */}
        <Animated.View style={[s.thumb, thumbStyle]} pointerEvents="none" />
      </View>
    </GestureDetector>
  );
}

function getStyles(t: Theme) {
  return {
    wheel: {
      width: SIZE,
      height: SIZE,
      alignSelf: 'center',
    },
    a11yTarget: {
      position: 'absolute',
      width: 44,
      height: 44,
    },
    pad: {
      position: 'absolute',
      width: PAD,
      height: PAD,
      borderRadius: PAD / 2,
    },
    thumb: {
      position: 'absolute',
      left: CENTER - THUMB / 2,
      top: CENTER - THUMB / 2,
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      // Ombre via token (§Annexe B) ; la bordure blanche ci-dessous prend le pas
      // sur la bordure dark du token (le blanc invariant outline le thumb).
      ...t.shadow.elevated,
      borderWidth: 3,
      borderColor: '#FFFFFF',
    },
  } as const;
}
