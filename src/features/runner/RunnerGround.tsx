// src/features/runner/RunnerGround.tsx — Sol defilant

import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

interface Props {
  groundOffset: SharedValue<number>;
  groundY: number;
  screenW: number;
}

const TILE_W = 80;
const MARK_COUNT = 30;

function RunnerGround({ groundOffset, groundY, screenW }: Props) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -groundOffset.value }],
  }));

  const groundHeight = Math.max(60, screenW * 0.16);

  const crystals = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      left: i * TILE_W * 6 + 120 + (i % 3) * 40,
      w: 4 + (i % 2) * 3,
      h: 6 + (i % 3) * 4,
    })),
    [],
  );

  return (
    <View style={{ position: 'absolute', top: groundY, left: 0, right: 0, height: groundHeight, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#2A2238', opacity: 0.5 }} />
      <View style={{ position: 'absolute', top: 2, left: 0, right: 0, height: groundHeight * 0.4, backgroundColor: '#0F0A1A' }} />
      <View style={{ position: 'absolute', top: 2 + groundHeight * 0.4, left: 0, right: 0, bottom: 0, backgroundColor: '#0A0614' }} />
      <Animated.View style={[{ flexDirection: 'row', position: 'absolute', top: 8, left: 0, zIndex: 1 }, animatedStyle]}>
        {Array.from({ length: MARK_COUNT }, (_, i) => (
          <View key={i} style={{ width: TILE_W, alignItems: 'center' }}>
            <View style={{ width: 12, height: 3, backgroundColor: '#2A2238', opacity: 0.3 }} />
          </View>
        ))}
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: 14, left: 0, zIndex: 1 }, animatedStyle]}>
        {crystals.map((c, i) => (
          <View
            key={`gc${i}`}
            style={{
              position: 'absolute', left: c.left, width: c.w, height: c.h,
              backgroundColor: '#1D1728', borderTopLeftRadius: 2, borderTopRightRadius: 2,
              opacity: 0.25,
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}

export default memo(RunnerGround);
