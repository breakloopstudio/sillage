// src/features/runner/RunnerObstacles.tsx — Pool d'obstacles (éclats de flacon, abeille, goutte)

import { memo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { OBSTACLE_DEFS, PALETTES, SPAWN_ENTRY_DISTANCE } from './runner-types';

interface ObsSlot {
  active: SharedValue<boolean>;
  x: SharedValue<number>;
  type: SharedValue<number>;
  y: SharedValue<number>;
  dropAt: SharedValue<number>;
}

interface Props { obs: ObsSlot[]; groundY: number; paletteIdx: number; screenW: number; }

// Révélation en fondu depuis le bord droit, à taille CONSTANTE (aucun zoom).
function entryOpacity(active: boolean, xVal: number, screenW: number) {
  'worklet';
  if (!active) return 0;
  return Math.min(1, Math.max(0, (screenW - xVal) / SPAWN_ENTRY_DISTANCE));
}

// Éclat de flacon brisé (verre violet translucide, reflets) — remplace les cristaux.
function Shard({ defIndex, paletteIdx }: { defIndex: number; paletteIdx: number }) {
  const d = OBSTACLE_DEFS[defIndex] ?? OBSTACLE_DEFS[0];
  const pal = PALETTES[paletteIdx % PALETTES.length];
  const colors = [pal.crystal, pal.crystal2, pal.crystal3, pal.crystal4];
  const bg = colors[defIndex % 4];
  return (
    <View style={{
      width: d.width,
      height: d.height,
      backgroundColor: bg,
      borderTopLeftRadius: defIndex % 2 === 0 ? 10 : 3,
      borderTopRightRadius: defIndex % 2 === 0 ? 3 : 9,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: defIndex % 2 === 0 ? 8 : 3,
      borderWidth: 1,
      borderColor: 'rgba(139,108,246,0.35)',
      overflow: 'hidden',
    }}>
      <View style={{ position: 'absolute', top: 2, left: 3, right: 4, height: 2, backgroundColor: 'rgba(255,255,255,0.32)', borderRadius: 1 }} />
      <View style={{ position: 'absolute', top: 0, left: '30%', width: 1.5, height: '100%', backgroundColor: 'rgba(255,255,255,0.14)', transform: [{ rotate: '18deg' }] }} />
      <View style={{ position: 'absolute', top: 0, left: '62%', width: 1, height: '80%', backgroundColor: 'rgba(255,255,255,0.10)', transform: [{ rotate: '-14deg' }] }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '26%', backgroundColor: 'rgba(139,108,246,0.18)' }} />
    </View>
  );
}

// Abeille (corps rayé + ailes) — ennemi volant qui ondule.
function Bee({ defIndex }: { defIndex: number }) {
  const d = OBSTACLE_DEFS[defIndex] ?? OBSTACLE_DEFS[4];
  return (
    <View style={{ width: d.width, height: d.height, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ position: 'absolute', top: -3, left: 3, width: 13, height: 9, borderRadius: 6, backgroundColor: 'rgba(237,232,245,0.35)', transform: [{ rotate: '-24deg' }] }} />
      <View style={{ position: 'absolute', top: -3, right: 3, width: 13, height: 9, borderRadius: 6, backgroundColor: 'rgba(237,232,245,0.28)', transform: [{ rotate: '24deg' }] }} />
      <View style={{ width: d.width - 6, height: d.height - 6, borderRadius: (d.height - 6) / 2, backgroundColor: '#F5C542', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)' }}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: '28%', width: 3, backgroundColor: '#1A1520' }} />
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: '52%', width: 3, backgroundColor: '#1A1520' }} />
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: '76%', width: 3, backgroundColor: '#1A1520' }} />
      </View>
    </View>
  );
}

// Goutte d'essence (gouttelette ambrée).
function Drop({ defIndex }: { defIndex: number }) {
  const d = OBSTACLE_DEFS[defIndex] ?? OBSTACLE_DEFS[5];
  return (
    <View style={{ width: d.width, height: d.height, justifyContent: 'flex-end', alignItems: 'center' }}>
      <View style={{ width: 6, height: 8, backgroundColor: '#E8A33A', borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
      <View style={{ width: d.width, height: d.width, borderRadius: d.width / 2, backgroundColor: '#E8A33A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', marginTop: -3, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: 3, left: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.55)' }} />
      </View>
    </View>
  );
}

// Ombre de télégraphie au sol (annonce la chute de la goutte).
function DropShadow({ defIndex }: { defIndex: number }) {
  const d = OBSTACLE_DEFS[defIndex] ?? OBSTACLE_DEFS[5];
  return (
    <View style={{ width: d.width + 8, height: 7, borderRadius: 4, backgroundColor: 'rgba(232,163,58,0.35)' }} />
  );
}

function Slot({ slot, groundY, paletteIdx, screenW }: { slot: ObsSlot; groundY: number; paletteIdx: number; screenW: number }) {
  const a = slot.active; const x = slot.x; const t = slot.type; const y = slot.y;

  const pos = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  const shadowPos = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - 4 }, { translateY: groundY - 4 }] }));

  const s0 = useAnimatedStyle(() => ({ opacity: entryOpacity(a.value && t.value === 0, x.value, screenW) }));
  const s1 = useAnimatedStyle(() => ({ opacity: entryOpacity(a.value && t.value === 1, x.value, screenW) }));
  const s2 = useAnimatedStyle(() => ({ opacity: entryOpacity(a.value && t.value === 2, x.value, screenW) }));
  const s3 = useAnimatedStyle(() => ({ opacity: entryOpacity(a.value && t.value === 3, x.value, screenW) }));
  const s4 = useAnimatedStyle(() => ({ opacity: entryOpacity(a.value && t.value === 4, x.value, screenW) }));
  const s5 = useAnimatedStyle(() => ({ opacity: entryOpacity(a.value && t.value === 5, x.value, screenW) }));

  return (
    <>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, shadowPos]}>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s5]}><DropShadow defIndex={5} /></Animated.View>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, pos]}>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s0]}><Shard defIndex={0} paletteIdx={paletteIdx} /></Animated.View>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s1]}><Shard defIndex={1} paletteIdx={paletteIdx} /></Animated.View>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s2]}><Shard defIndex={2} paletteIdx={paletteIdx} /></Animated.View>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s3]}><Shard defIndex={3} paletteIdx={paletteIdx} /></Animated.View>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s4]}><Bee defIndex={4} /></Animated.View>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s5]}><Drop defIndex={5} /></Animated.View>
      </Animated.View>
    </>
  );
}

function RunnerObstaclesImpl({ obs, groundY, paletteIdx, screenW }: Props) {
  return <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
    {obs.map((s, i) => <Slot key={i} slot={s} groundY={groundY} paletteIdx={paletteIdx} screenW={screenW} />)}
  </View>;
}

export default memo(RunnerObstaclesImpl);
