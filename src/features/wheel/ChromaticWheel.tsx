// src/features/wheel/ChromaticWheel.tsx — Roue chromatique (feature couleur)
// Anneau spectre SVG STRICTEMENT STATIQUE (144 segments, rendu 1×, React.memo) +
// thumb Animated.View piloté en SharedValue (Gesture.Pan worklet + atan2, UI
// thread, pattern Runner/DockBar — zéro setState pendant le drag). Le snap vers
// l'ancre la plus proche est résolu en worklet ; le JS n'est réveillé que sur
// événement discret (franchissement d'ancre, commit fin de geste, tap).
// Les 3 neutres (noir/blanc/gris) vivent au centre (pas de hue sur l'anneau).

import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, useDerivedValue, useAnimatedReaction,
  withTiming, runOnJS, interpolateColor, cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme, type Theme } from '../../theme/ThemeContext';
import {
  RING_ANCHORS, CENTER_NEUTRALS, CHROMA_PALETTE_LIGHT, chromaSwatch,
  getColorByKey, hsvToHex, type ChromaticKey,
} from '../../utils/chromatic-wheel';

// ─── Géométrie (constantes pures, précalculées au scope module) ──────────────

const SIZE = 300;
const CENTER = SIZE / 2;
const RING_OUTER = 140;
const RING_WIDTH = 36;
const RING_R = RING_OUTER - RING_WIDTH / 2;
const CENTER_R = RING_OUTER - RING_WIDTH - 10;
const THUMB = 30;
const PAD = 46;
const PAD_ORBIT = 44;

const DEG = Math.PI / 180;

function pointAt(deg: number, radius: number): { x: number; y: number } {
  const a = (deg - 90) * DEG;
  return { x: CENTER + Math.cos(a) * radius, y: CENTER + Math.sin(a) * radius };
}

// Segments du spectre : paths + couleurs figés une fois (jamais re-rendus).
const SEGMENTS = (() => {
  const out: { d: string; color: string }[] = [];
  const N = 144;
  const step = 360 / N;
  for (let i = 0; i < N; i++) {
    const p0 = pointAt(i * step, RING_R);
    const p1 = pointAt((i + 1) * step + 0.6, RING_R);
    out.push({
      d: `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${RING_R} ${RING_R} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
      color: hsvToHex(i * step, 0.62, 0.88),
    });
  }
  return out;
})();

// Couleurs du spectre pour interpolateColor (thumb).
const SPECTRUM_STOPS = [0, 60, 120, 180, 240, 300, 360];
const SPECTRUM_COLORS = SPECTRUM_STOPS.map(h => hsvToHex(h, 0.62, 0.88));

// Ancres de l'anneau (hues triées) + positions des pastilles.
// Le marron (20°) est à 5° de l'orange (25°) : pastille décalée vers l'intérieur
// de l'anneau pour éviter la superposition visuelle.
const ANCHOR_HUES = RING_ANCHORS.map(a => a.hue ?? 0);
const ANCHOR_KEYS = RING_ANCHORS.map(a => a.key);
const ANCHOR_DOTS = RING_ANCHORS.map(a => ({
  key: a.key,
  ...pointAt(a.hue ?? 0, a.key === 'brown' ? RING_R - 13 : RING_R),
  color: CHROMA_PALETTE_LIGHT[a.key].swatch,
}));

// Neutres au centre : triangle équilatéral (noir en haut, blanc en bas à droite,
// gris en bas à gauche). ORDER = CENTER_NEUTRALS (black, white, gray).
const PAD_ANGLES = [0, 120, 240];
const PAD_CENTERS = CENTER_NEUTRALS.map((c, i) => pointAt(PAD_ANGLES[i % PAD_ANGLES.length], PAD_ORBIT));
const PAD_KEYS = CENTER_NEUTRALS.map(c => c.key);
const PAD_HIT_R = PAD / 2 + 8;

// ─── Helpers worklet-safe (module scope, primitives uniquement) ──────────────

function nearestAnchorIdx(deg: number): number {
  'worklet';
  let best = 0;
  let bestDist = 361;
  for (let i = 0; i < ANCHOR_HUES.length; i++) {
    let d = Math.abs(deg - ANCHOR_HUES[i]);
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

// ─── Anneau SVG statique (rendu 1×, mémoïsé — jamais re-rendu) ───────────────

const WheelRing = memo(function WheelRing() {
  return (
    <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
      {SEGMENTS.map((seg, i) => (
        <Path key={i} d={seg.d} stroke={seg.color} strokeWidth={RING_WIDTH} fill="none" strokeLinecap="butt" />
      ))}
      {/* Bordure blanche invariante sur élément coloré (esprit §2.3, spectre invariant) */}
      {ANCHOR_DOTS.map(dot => (
        <Circle
          key={dot.key}
          cx={dot.x}
          cy={dot.y}
          r={6.5}
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
  /** Franchissement d'ancre pendant le geste (affichage live, pas de fetch). */
  onAnchorChange: (key: ChromaticKey) => void;
  /** Commit : fin de geste anneau / tap anneau / tap pastille neutre. */
  onCommit: (key: ChromaticKey) => void;
  /** Geste relâché hors anneau/pastille (le parent restaure la preview). */
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
        { translateX: Math.cos(a) * RING_R },
        { translateY: Math.sin(a) * RING_R },
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
    // Snap visuel vers l'ancre (chemin le plus court).
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

  // A11y (§6.8) : rôle adjustable avec actions réelles — incrémenter/décrémenter
  // parcourt les ancres de l'anneau et commite la teinte.
  const selectedRingIdx = selectedKey ? RING_ANCHORS.findIndex(a => a.key === selectedKey) : -1;
  const handleAccessibilityAction = useCallback((e: { nativeEvent: { actionName: string } }) => {
    const name = e.nativeEvent.actionName;
    if (name !== 'increment' && name !== 'decrement') return;
    const n = RING_ANCHORS.length;
    const base = selectedRingIdx >= 0 ? selectedRingIdx : 0;
    const next = name === 'increment' ? (base + 1) % n : (base - 1 + n) % n;
    commitRingIdx(next);
  }, [selectedRingIdx, commitRingIdx]);
  const selectedDef = selectedKey ? getColorByKey(selectedKey) : undefined;

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
        if (r < CENTER_R * 0.6) return;
        angleDeg.value = degFromPoint(e.x, e.y);
      })
      .onEnd((e) => {
        'worklet';
        // Pastilles d'abord (leur hit zone déborde du disque central).
        const pad = nearestPadIdx(e.x, e.y);
        if (pad >= 0) {
          runOnJS(commitNeutralIdx)(pad);
          return;
        }
        const r = Math.hypot(e.x - CENTER, e.y - CENTER);
        if (r >= CENTER_R * 0.6) {
          runOnJS(commitRingIdx)(nearestAnchorIdx(degFromPoint(e.x, e.y)));
        } else {
          // Relâché dans le disque central hors pastille → geste sans commit.
          runOnJS(notifyCancel)();
        }
      });

    const tap = Gesture.Tap()
      .onEnd((e) => {
        'worklet';
        // Pastilles d'abord : un tap sur leur hit zone ne doit jamais committer
        // une ancre de l'anneau (chevauchement couronne r ∈ [56 ; 75]).
        const pad = nearestPadIdx(e.x, e.y);
        if (pad >= 0) {
          runOnJS(commitNeutralIdx)(pad);
          return;
        }
        const r = Math.hypot(e.x - CENTER, e.y - CENTER);
        if (r >= CENTER_R * 0.6 && r <= RING_OUTER + 26) {
          runOnJS(commitRingIdx)(nearestAnchorIdx(degFromPoint(e.x, e.y)));
        }
      });

    return Gesture.Race(tap, pan);
  }, [commitRingIdx, commitNeutralIdx, notifyCancel]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={s.wheel}
        accessibilityRole="adjustable"
        accessibilityLabel={t('chroma.wheelA11y')}
        accessibilityHint={t('chroma.wheelHintA11y')}
        accessibilityValue={selectedDef ? { text: selectedDef.label } : undefined}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={handleAccessibilityAction}
      >
        <WheelRing />

        {/* Disque central */}
        <View style={s.centerDisc} pointerEvents="none" />

        {/* Pastilles neutres — accessibles individuellement (§6.8 : l'info
            couleur-seule est doublée d'un label verbalisé). Le toucher physique
            passe par le geste du parent ; onAccessibilityActivate sert les SR. */}
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
              accessibilityState={{ selected: active }}
              accessibilityActions={[{ name: 'activate' }]}
              onAccessibilityAction={() => commitNeutralIdx(i)}
            />
          );
        })}

        {/* Thumb (par-dessus l'anneau, UI thread). Bordure blanche invariante :
            blanc sur élément coloré, esprit §2.3 (comme le texte des boutons
            colorés) — le spectre est invariant entre thèmes. */}
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
    centerDisc: {
      position: 'absolute',
      left: CENTER - CENTER_R,
      top: CENTER - CENTER_R,
      width: CENTER_R * 2,
      height: CENTER_R * 2,
      borderRadius: CENTER_R,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
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
