// src/features/runner/RunnerPickups.tsx — Badges réduction

import { memo, useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import { PICKUP_DEFS, PICKUP_POOL_SIZE, PICKUP_SIZE, SPAWN_ENTRY_DISTANCE } from './runner-types';

interface PkpSlot { active: SharedValue<boolean>; x: SharedValue<number>; type: SharedValue<number>; y: SharedValue<number>; }

interface Props { pkp: PkpSlot[]; reduceMotion?: boolean; screenW: number; }

function Badge({ emoji, color }: { emoji: string; color: string }) {
  return <View style={{ width: PICKUP_SIZE, height: PICKUP_SIZE, borderRadius: PICKUP_SIZE / 2, backgroundColor: color, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 10, elevation: 4 }}>
    <Text allowFontScaling={false} style={{ fontSize: 18, textAlign: 'center', includeFontPadding: false }}>{emoji}</Text>
  </View>;
}

function Slot({ slot, reduceMotion, screenW }: { slot: PkpSlot; reduceMotion: boolean; screenW: number }) {
  const a = slot.active; const x = slot.x; const t = slot.type; const y = slot.y;
  const bob = useSharedValue(0);

  useEffect(() => {
    if (!reduceMotion) {
      bob.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 600 }),
          withTiming(0, { duration: 600 }),
        ),
        -1,
        false,
      );
    }
    return () => { cancelAnimation(bob); };
  }, [reduceMotion]);

  const pos = useAnimatedStyle(() => {
    const entry = a.value ? Math.min(1, Math.max(0, (screenW - x.value) / SPAWN_ENTRY_DISTANCE)) : 0;
    return {
      transform: [{ translateX: x.value }, { translateY: y.value + bob.value }],
      opacity: entry,
    };
  });
  const s0 = useAnimatedStyle(() => ({ opacity: t.value === 0 ? 1 : 0 }));
  const s1 = useAnimatedStyle(() => ({ opacity: t.value === 1 ? 1 : 0 }));
  const s2 = useAnimatedStyle(() => ({ opacity: t.value === 2 ? 1 : 0 }));
  const s3 = useAnimatedStyle(() => ({ opacity: t.value === 3 ? 1 : 0 }));

  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, pos]}>
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s0]}><Badge emoji={PICKUP_DEFS[0].emoji} color={PICKUP_DEFS[0].color} /></Animated.View>
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s1]}><Badge emoji={PICKUP_DEFS[1].emoji} color={PICKUP_DEFS[1].color} /></Animated.View>
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s2]}><Badge emoji={PICKUP_DEFS[2].emoji} color={PICKUP_DEFS[2].color} /></Animated.View>
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, s3]}><Badge emoji={PICKUP_DEFS[3].emoji} color={PICKUP_DEFS[3].color} /></Animated.View>
  </Animated.View>;
}

function RunnerPickupsImpl({ pkp, reduceMotion = false, screenW }: Props) {
  return <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
    {pkp.map((s, i) => <Slot key={i} slot={s} reduceMotion={reduceMotion} screenW={screenW} />)}
  </View>;
}

export default memo(RunnerPickupsImpl);
