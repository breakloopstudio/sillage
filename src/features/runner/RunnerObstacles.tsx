// src/features/runner/RunnerObstacles.tsx — Pool d'obstacles

import { memo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { OBSTACLE_DEFS, OBSTACLE_POOL_SIZE, FLYING_OBSTACLE_Y_OFFSET, PALETTES } from './runner-types';

interface ObsSlot { active: SharedValue<boolean>; x: SharedValue<number>; type: SharedValue<number>; }

interface Props { obs: ObsSlot[]; groundY: number; paletteIdx: number; }

function Crystal({ defIndex, paletteIdx }: { defIndex: number; paletteIdx: number }) {
  const d = OBSTACLE_DEFS[defIndex] ?? OBSTACLE_DEFS[0];
  const pal = PALETTES[paletteIdx % PALETTES.length];
  const colors = [pal.crystal, pal.crystal2, pal.crystal3, pal.crystal4];
  const bg = colors[defIndex % 4];
  return (
    <View style={{
      width: d.width,
      height: d.height,
      backgroundColor: bg,
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
      borderBottomLeftRadius: 3,
      borderBottomRightRadius: 3,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      overflow: 'hidden',
    }}>
      <View style={{ position: 'absolute', top: 3, left: 3, right: 3, height: 2, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 1 }} />
      <View style={{ position: 'absolute', top: 0, left: '40%', width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.06)', transform: [{ rotate: '15deg' }] }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', backgroundColor: 'rgba(255,255,255,0.04)' }} />
    </View>
  );
}

function Slot({ slot, groundY, paletteIdx }: { slot: ObsSlot; groundY: number; paletteIdx: number }) {
  const a = slot.active; const x = slot.x; const t = slot.type;

  const pos = useAnimatedStyle(() => {
    const d = OBSTACLE_DEFS[t.value] ?? OBSTACLE_DEFS[0];
    const y = d.airborne ? groundY - FLYING_OBSTACLE_Y_OFFSET : groundY - d.height;
    return { transform: [{ translateX: x.value }, { translateY: y }], opacity: a.value ? 1 : 0 };
  });

  const s0 = useAnimatedStyle(() => ({ opacity: t.value === 0 ? 1 : 0 }));
  const s1 = useAnimatedStyle(() => ({ opacity: t.value === 1 ? 1 : 0 }));
  const s2 = useAnimatedStyle(() => ({ opacity: t.value === 2 ? 1 : 0 }));
  const s3 = useAnimatedStyle(() => ({ opacity: t.value === 3 ? 1 : 0 }));
  const s4 = useAnimatedStyle(() => ({ opacity: t.value === 4 ? 1 : 0 }));

  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, pos]}>
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s0]}><Crystal defIndex={0} paletteIdx={paletteIdx} /></Animated.View>
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s1]}><Crystal defIndex={1} paletteIdx={paletteIdx} /></Animated.View>
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s2]}><Crystal defIndex={2} paletteIdx={paletteIdx} /></Animated.View>
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s3]}><Crystal defIndex={3} paletteIdx={paletteIdx} /></Animated.View>
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s4]}><Crystal defIndex={4} paletteIdx={paletteIdx} /></Animated.View>
  </Animated.View>;
}

function RunnerObstaclesImpl({ obs, groundY, paletteIdx }: Props) {
  return <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
    {obs.map((s, i) => <Slot key={i} slot={s} groundY={groundY} paletteIdx={paletteIdx} />)}
  </View>;
}

export default memo(RunnerObstaclesImpl);
