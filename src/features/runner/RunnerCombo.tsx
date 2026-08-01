// src/features/runner/RunnerCombo.tsx — Compteur de combo aérien (UI thread)
// Affiche « ×N » au centre de l'écran pendant un enchaînement aérien (≥ 2 pickups sans
// atterrir). Pulse à chaque pickup, vire au doré à ×4. Coupé en Reduced Motion.

import { memo, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
  interpolateColor,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { RUNNER_COLORS } from './runner-types';

interface Props {
  airCombo: SharedValue<number>;
  reduceMotion: boolean;
  centerY: number;
}

function RunnerCombo({ airCombo, reduceMotion, centerY }: Props) {
  const [combo, setCombo] = useState(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useAnimatedReaction(
    () => airCombo.value,
    (value, prev) => {
      scheduleOnRN(setCombo, value);
      if (value > 1) {
        opacity.value = 1;
        if (!reduceMotion) {
          scale.value = 1.45;
          scale.value = withSpring(1, { damping: 10, stiffness: 400 });
        }
      } else if (prev != null && prev > 1) {
        opacity.value = withTiming(0, { duration: 150 });
      }
    },
  );

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(Math.max(2, airCombo.value), [2, 4], [RUNNER_COLORS.violet, RUNNER_COLORS.gold]),
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', top: centerY, left: 0, right: 0, alignItems: 'center', zIndex: 42 },
        wrapStyle,
      ]}
      pointerEvents="none"
      accessibilityElementsHidden
    >
      <Animated.Text
        allowFontScaling={false}
        style={[
          {
            fontFamily: 'Inter_800ExtraBold',
            fontSize: 28,
            textShadowColor: 'rgba(0,0,0,0.5)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          },
          textStyle,
        ]}
      >
        ×{Math.max(2, combo)}
      </Animated.Text>
    </Animated.View>
  );
}

export default memo(RunnerCombo);
