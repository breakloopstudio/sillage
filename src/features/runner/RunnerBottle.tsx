// src/features/runner/RunnerBottle.tsx — Flacon joueur anime

import { memo } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import { BOTTLE_WIDTH, BOTTLE_HEIGHT } from './runner-types';

interface Props {
  bottleX: number;
  bottleY: SharedValue<number>;
  isJumping: SharedValue<boolean>;
  isDoubleJumping: SharedValue<boolean>;
  landingTrigger: SharedValue<number>;
  gameState: SharedValue<string>;
  bottleColor?: string;
  capColor?: string;
  reduceMotion?: boolean;
  groundY: number;
}

function RunnerBottle({
  bottleX,
  bottleY,
  isJumping,
  isDoubleJumping,
  landingTrigger,
  gameState,
  bottleColor = '#6C3ED9',
  capColor = '#D4A960',
  reduceMotion = false,
  groundY,
}: Props) {
  const idleBob = useSharedValue(0);
  const spinAngle = useSharedValue(0);

  const bottleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: bottleX },
      { translateY: bottleY.value - BOTTLE_HEIGHT + idleBob.value },
    ],
  }));

  const sqX = useSharedValue(1);
  const sqY = useSharedValue(1);
  const bottleOpacity = useSharedValue(1);
  const flashOpacity = useSharedValue(0);

  useAnimatedReaction(
    () => landingTrigger.value,
    () => {
      sqY.value = 0.78;
      sqX.value = 1.25;
      sqY.value = withSpring(1, { damping: 10, stiffness: 300 });
      sqX.value = withSpring(1, { damping: 10, stiffness: 300 });
    },
  );

  useAnimatedReaction(
    () => isDoubleJumping.value,
    (dj) => {
      if (dj && !reduceMotion) {
        spinAngle.value = 0;
        spinAngle.value = withTiming(360, { duration: 350 });
      }
    },
  );

  useAnimatedReaction(
    () => gameState.value,
    (state) => {
      if (state === 'dying') {
        cancelAnimation(idleBob);
        idleBob.value = withTiming(0, { duration: 100 });
        if (!reduceMotion) {
          flashOpacity.value = 1;
          flashOpacity.value = withSpring(0, { damping: 12, stiffness: 200 });
        }
        bottleOpacity.value = 0.35;
      }
      if (state === 'idle') {
        bottleOpacity.value = 1;
        flashOpacity.value = 0;
        sqX.value = 1;
        sqY.value = 1;
        if (!reduceMotion) {
          idleBob.value = withRepeat(
            withSequence(
              withTiming(-2.5, { duration: 1000 }),
              withTiming(0, { duration: 1000 }),
            ),
            -1,
            false,
          );
        }
      }
      if (state === 'playing') {
        cancelAnimation(idleBob);
        idleBob.value = withTiming(0, { duration: 150 });
        bottleOpacity.value = 1;
        flashOpacity.value = 0;
      }
    },
  );

  const bodyStyle = useAnimatedStyle(() => {
    const heightAboveGround = Math.max(0, groundY - bottleY.value);
    const airStretch = isJumping.value
      ? 1 + heightAboveGround * 0.0003
      : 1;
    const spin = reduceMotion ? 0 : spinAngle.value;
    return {
      transform: [
        { scaleX: Math.min(1.12, airStretch * 0.95 + 0.05) * sqX.value },
        { scaleY: Math.min(1.12, airStretch) * sqY.value },
        { rotate: `${spin}deg` },
      ],
      opacity: bottleOpacity.value,
    };
  });

  const flashStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFFFFF',
    opacity: flashOpacity.value,
    borderRadius: 4,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: BOTTLE_WIDTH,
          height: BOTTLE_HEIGHT,
        },
        bottleStyle,
      ]}
    >
      <Animated.View style={[{ width: BOTTLE_WIDTH, height: BOTTLE_HEIGHT }, bodyStyle]}>
        <View style={{ width: 14, height: 10, backgroundColor: capColor, borderRadius: 3, alignSelf: 'center' }} />
        <View style={{ width: 8, height: 8, backgroundColor: bottleColor, alignSelf: 'center' }} />
        <View style={{ flex: 1, backgroundColor: bottleColor, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, alignItems: 'center', overflow: 'hidden' }}>
          <View style={{ width: 14, height: 12, backgroundColor: capColor, borderRadius: 2, marginTop: 6 }} />
          <View style={{ position: 'absolute', top: 4, left: 3, width: 2, height: '60%', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
        </View>
      </Animated.View>
      <Animated.View style={flashStyle} pointerEvents="none" />
    </Animated.View>
  );
}

export default memo(RunnerBottle);
