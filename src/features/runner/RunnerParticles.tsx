// src/features/runner/RunnerParticles.tsx — Burst de particules a la collecte

import { memo } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { BOTTLE_HEIGHT } from './runner-types';

const COUNT = 8;

interface Props {
  trigger: SharedValue<number>;
  originX: number;
  bottleY: SharedValue<number>;
  reduceMotion: boolean;
}

function Particle({ index, trigger, reduceMotion }: { index: number; trigger: SharedValue<number>; reduceMotion: boolean }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const op = useSharedValue(0);
  const sc = useSharedValue(0.4);

  useAnimatedReaction(
    () => trigger.value,
    (t, prev) => {
      if (prev == null || t === prev || reduceMotion) return;
      const angle = (index / COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 26 + Math.random() * 30;
      tx.value = 0;
      ty.value = 0;
      op.value = 1;
      sc.value = 0.5 + Math.random() * 0.5;
      const dur = 420 + Math.random() * 220;
      tx.value = withTiming(Math.cos(angle) * dist, { duration: dur, easing: Easing.out(Easing.cubic) });
      ty.value = withTiming(Math.sin(angle) * dist - 12, { duration: dur, easing: Easing.out(Easing.cubic) });
      op.value = withTiming(0, { duration: dur });
    },
  );

  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: index % 2 === 0 ? '#D4A960' : '#8B6CF6',
        },
        style,
      ]}
    />
  );
}

function RunnerParticles({ trigger, originX, bottleY, reduceMotion }: Props) {
  const origin = useAnimatedStyle(() => ({
    transform: [{ translateX: originX }, { translateY: bottleY.value - BOTTLE_HEIGHT / 2 }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, origin]} pointerEvents="none">
      {Array.from({ length: COUNT }, (_, i) => (
        <Particle key={i} index={i} trigger={trigger} reduceMotion={reduceMotion} />
      ))}
    </Animated.View>
  );
}

export default memo(RunnerParticles);
