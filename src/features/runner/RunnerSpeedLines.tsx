// src/features/runner/RunnerSpeedLines.tsx — Traits de vitesse horizontaux

import { memo } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { SPEED_LINE_MIN_SPEED, MAX_SPEED, SPEED_LINE_COUNT } from './runner-types';

interface Props {
  groundY: number;
  speedLineOffset: SharedValue<number>;
  speed: SharedValue<number>;
}

function RunnerSpeedLines({ groundY, speedLineOffset, speed }: Props) {
  const style = useAnimatedStyle(() => ({
    opacity: speed.value > SPEED_LINE_MIN_SPEED
      ? (speed.value - SPEED_LINE_MIN_SPEED) / (MAX_SPEED - SPEED_LINE_MIN_SPEED) * 0.3
      : 0,
    transform: [{ translateX: -(speedLineOffset.value % 600) }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, style]} pointerEvents="none">
      {Array.from({ length: SPEED_LINE_COUNT }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row' }}>
          {[0, 600].map(shift => (
            <View key={shift} style={{ flexDirection: 'row', width: 600 }}>
              {Array.from({ length: 4 }, (_, j) => (
                <View
                  key={j}
                  style={{
                    position: 'absolute',
                    top: groundY * (0.35 + i * 0.15),
                    left: shift + j * 150 + (i * 30),
                    width: 80 + i * 30,
                    height: 2,
                    backgroundColor: '#EDE8F5',
                    opacity: 0.6 - i * 0.15,
                    borderRadius: 1,
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

export default memo(RunnerSpeedLines);
