// src/features/runner/RunnerGround.tsx — Piste qui défile (side-scroller)
// Sol ancré de groundY jusqu'en bas de l'écran (rien ne transparaît dessous).
// Crête lumineuse = ligne de fuite ; stries défilantes sur 2 plans = vitesse + profondeur.

import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

function RunnerGround({ groundOffset, groundY, screenW }: Props) {
  const nearStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -(groundOffset.value % TILE_W) }],
  }));
  const farStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -((groundOffset.value * 0.6) % (TILE_W * 2)) }],
  }));

  const nearCount = Math.ceil(screenW / TILE_W) + 3;
  const farCount = Math.ceil(screenW / (TILE_W * 2)) + 3;

  const pebbles = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      left: i * TILE_W * 5 + 90 + (i % 3) * 50,
      w: 3 + (i % 2) * 3,
      h: 5 + (i % 3) * 4,
    })),
    [],
  );

  return (
    <View style={{ position: 'absolute', top: groundY, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <LinearGradient
        colors={['#1A1228', '#100A1C', '#0A0614', '#060410']}
        locations={[0, 0.25, 0.6, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(212,169,96,0.55)' }} />
      <View style={{ position: 'absolute', top: 2, left: 0, right: 0, height: 2, backgroundColor: 'rgba(139,108,246,0.45)' }} />

      <Animated.View style={[{ flexDirection: 'row', position: 'absolute', top: 9, left: 0 }, nearStyle]}>
        {Array.from({ length: nearCount }, (_, i) => (
          <View key={i} style={{ width: TILE_W, alignItems: 'center' }}>
            <View style={{ width: 30, height: 2, backgroundColor: 'rgba(237,232,245,0.22)', borderRadius: 1 }} />
          </View>
        ))}
      </Animated.View>

      <Animated.View style={[{ flexDirection: 'row', position: 'absolute', top: 26, left: 0 }, farStyle]}>
        {Array.from({ length: farCount }, (_, i) => (
          <View key={i} style={{ width: TILE_W * 2, alignItems: 'center' }}>
            <View style={{ width: 44, height: 2, backgroundColor: 'rgba(139,108,246,0.16)', borderRadius: 1 }} />
          </View>
        ))}
      </Animated.View>

      <Animated.View style={[{ position: 'absolute', top: 40, left: 0 }, nearStyle]}>
        {pebbles.map((c, i) => (
          <View
            key={`gc${i}`}
            style={{
              position: 'absolute', left: c.left, width: c.w, height: c.h,
              backgroundColor: '#241A36', borderTopLeftRadius: 2, borderTopRightRadius: 2,
              opacity: 0.5,
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}

export default memo(RunnerGround);
