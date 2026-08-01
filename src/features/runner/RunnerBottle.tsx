// src/features/runner/RunnerBottle.tsx — Flacon joueur anime

import { memo } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  useDerivedValue,
  interpolateColor,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import { BOTTLE_WIDTH, BOTTLE_HEIGHT, DUCK_SCALE, type GameStateValue } from './runner-types';

interface Props {
  bottleX: number;
  bottleY: SharedValue<number>;
  isJumping: SharedValue<boolean>;
  isDoubleJumping: SharedValue<boolean>;
  landingTrigger: SharedValue<number>;
  gameState: SharedValue<GameStateValue>;
  bottleColor?: string;
  capColor?: string;
  reduceMotion?: boolean;
  groundY: number;
  shieldActive: SharedValue<boolean>;
  gameTime: SharedValue<number>;
  magnetUntil: SharedValue<number>;
  doubleUntil: SharedValue<number>;
  slowUntil: SharedValue<number>;
  lives: SharedValue<number>;
  invulnUntil: SharedValue<number>;
  duckUntil: SharedValue<number>;
  feverUntil: SharedValue<number>;
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
  shieldActive,
  gameTime,
  magnetUntil,
  doubleUntil,
  slowUntil,
  lives,
  invulnUntil,
  duckUntil,
  feverUntil,
}: Props) {
  const idleBob = useSharedValue(0);
  const spinAngle = useSharedValue(0);

  const bottleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: bottleX },
      { translateY: bottleY.value - BOTTLE_HEIGHT + idleBob.value },
    ],
  }));

  const auraKind = useDerivedValue(() => {
    if (gameTime.value < feverUntil.value) return 5;
    if (shieldActive.value) return 2;
    if (gameTime.value < slowUntil.value) return 4;
    if (gameTime.value < doubleUntil.value) return 3;
    if (gameTime.value < magnetUntil.value) return 1;
    return 0;
  });

  const auraStyle = useAnimatedStyle(() => {
    const kind = auraKind.value;
    return {
      opacity: kind === 0 ? 0 : 0.5,
      backgroundColor: interpolateColor(kind, [0, 1, 2, 3, 4, 5], ['#000000', '#B5C334', '#A9744F', '#E8933A', '#9A8FC0', '#D4A960']),
    };
  });

  const shieldStyle = useAnimatedStyle(() => ({
    opacity: shieldActive.value ? 0.9 : 0,
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
    const invuln = gameTime.value < invulnUntil.value;
    const flicker = invuln && !reduceMotion ? 0.4 + 0.45 * Math.abs(Math.sin(gameTime.value * 28)) : 1;
    // Glissade : le flacon s'accroupit (scaleY réduit, scaleX élargi), base compensée au sol.
    const ducking = !isJumping.value && gameTime.value < duckUntil.value;
    const duckScaleY = ducking ? DUCK_SCALE : 1;
    const duckScaleX = ducking ? 1.25 : 1;
    const duckCompensate = ducking ? (BOTTLE_HEIGHT * (1 - DUCK_SCALE)) / 2 : 0;
    return {
      transform: [
        { translateY: duckCompensate },
        { scaleX: Math.min(1.12, airStretch * 0.95 + 0.05) * sqX.value * duckScaleX },
        { scaleY: Math.min(1.12, airStretch) * sqY.value * duckScaleY },
        { rotate: `${spin}deg` },
      ],
      opacity: bottleOpacity.value * flicker,
    };
  });

  const crackAStyle = useAnimatedStyle(() => ({ opacity: lives.value <= 2 ? 0.65 : 0 }));
  const crackBStyle = useAnimatedStyle(() => ({ opacity: lives.value <= 1 ? 0.65 : 0 }));

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
      <Animated.View
        style={[{ position: 'absolute', left: -17, top: -4, width: 64, height: 64, borderRadius: 32 }, auraStyle]}
        pointerEvents="none"
      />
      <Animated.View
        style={[{ position: 'absolute', left: -8, top: -5, width: 46, height: 66, borderRadius: 23, borderWidth: 2, borderColor: '#A9744F' }, shieldStyle]}
        pointerEvents="none"
      />
      <Animated.View style={[{ width: BOTTLE_WIDTH, height: BOTTLE_HEIGHT }, bodyStyle]}>
        <View style={{ width: 14, height: 10, backgroundColor: capColor, borderRadius: 3, alignSelf: 'center' }} />
        <View style={{ width: 8, height: 8, backgroundColor: bottleColor, alignSelf: 'center' }} />
        <View style={{ flex: 1, backgroundColor: bottleColor, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, alignItems: 'center', overflow: 'hidden' }}>
          <View style={{ width: 14, height: 12, backgroundColor: capColor, borderRadius: 2, marginTop: 6 }} />
          <View style={{ position: 'absolute', top: 4, left: 3, width: 2, height: '60%', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
          <Animated.View style={[{ position: 'absolute', top: 5, left: 7, width: 1.5, height: 22, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 1, transform: [{ rotate: '27deg' }] }, crackAStyle]} pointerEvents="none" />
          <Animated.View style={[{ position: 'absolute', top: 9, left: 15, width: 1.5, height: 18, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 1, transform: [{ rotate: '-33deg' }] }, crackBStyle]} pointerEvents="none" />
          <Animated.View style={[{ position: 'absolute', top: 16, left: 11, width: 1.5, height: 10, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 1, transform: [{ rotate: '70deg' }] }, crackBStyle]} pointerEvents="none" />
        </View>
      </Animated.View>
      <Animated.View style={flashStyle} pointerEvents="none" />
    </Animated.View>
  );
}

export default memo(RunnerBottle);
