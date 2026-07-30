// src/features/runner/RunnerBackground.tsx — Ciel + horizon + parallaxe seamless
// Tout le décor est ancré sur groundY (la ligne de fuite) : ciel dégradé au-dessus,
// lueur d'horizon, collines lointaines + skyline de flacons posés sur l'horizon.

import { useMemo, memo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { PALETTES } from './runner-types';

interface Props {
  bgOffset: SharedValue<number>;
  midOffset: SharedValue<number>;
  paletteIdx: number;
  groundY: number;
}

const FAR_PERIOD = 1200;
const MID_PERIOD = 1400;
const HORIZON_GLOW = 120;

// Collines lointaines (plan le plus lent) — reposent sur l'horizon.
function FarLayer({ offset, color, bottom }: { offset: SharedValue<number>; color: string; bottom: number }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -(offset.value % FAR_PERIOD) }],
  }));

  const hills = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => ({
      left: i * 175 + 10,
      width: 150 + (i % 3) * 40,
      height: 26 + (i % 2) * 22,
    })),
    [],
  );

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, bottom, height: 90, width: FAR_PERIOD * 2, flexDirection: 'row' }, style]}>
      {[0, FAR_PERIOD].map(shift => (
        <View key={shift} style={{ width: FAR_PERIOD, height: '100%', position: 'relative' }}>
          {hills.map((h, j) => (
            <View
              key={j}
              style={{
                position: 'absolute', left: h.left, bottom: 0,
                width: h.width, height: h.height,
                backgroundColor: color, borderTopLeftRadius: 90, borderTopRightRadius: 90,
                opacity: 0.7,
              }}
            />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

// Skyline de flacons (plan moyen) — silhouettes posées sur l'horizon, défilent = profondeur.
function MidLayer({ offset, bottleColor, capColor, crystalColor, bottom }: { offset: SharedValue<number>; bottleColor: string; capColor: string; crystalColor: string; bottom: number }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -(offset.value % MID_PERIOD) }],
  }));

  const flacons = useMemo(() =>
    Array.from({ length: 9 }, (_, i) => ({
      left: i * 155 + 12 + (i % 3) * 18,
      width: 9 + (i % 3) * 5,
      height: 20 + (i % 4) * 13,
      cap: i % 2 === 0,
      far: i % 3 === 0,
    })),
    [],
  );

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, bottom, height: 80, width: MID_PERIOD * 2, flexDirection: 'row' }, style]}>
      {[0, MID_PERIOD].map(shift => (
        <View key={shift} style={{ width: MID_PERIOD, height: '100%', position: 'relative' }}>
          {flacons.map((f, j) => {
            const bg = f.far ? crystalColor : bottleColor;
            const op = f.far ? 0.3 : 0.42;
            return (
              <View key={j} style={{ position: 'absolute', left: f.left, bottom: 0, width: f.width, height: f.height, opacity: op }}>
                {f.cap && (
                  <View style={{ position: 'absolute', top: -4, left: f.width * 0.25, width: f.width * 0.5, height: 5, backgroundColor: capColor, opacity: 0.5, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
                )}
                <View style={{ flex: 1, backgroundColor: bg, borderTopLeftRadius: 3, borderTopRightRadius: 3, borderBottomLeftRadius: 1, borderBottomRightRadius: 1 }} />
              </View>
            );
          })}
        </View>
      ))}
    </Animated.View>
  );
}

function RunnerBackground({ bgOffset, midOffset, paletteIdx, groundY }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const pal = PALETTES[paletteIdx % PALETTES.length];
  const horizonBottom = Math.max(0, screenH - groundY);

  const starPositions = useMemo(() =>
    Array.from({ length: 44 }, () => ({
      x: Math.random() * screenW,
      yFrac: Math.random() * 0.82,
      size: 1 + Math.random() * 1.6,
      opacity: 0.18 + Math.random() * 0.5,
    })),
    [screenW],
  );

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <LinearGradient
        colors={['#080510', '#0B0716', '#100A20', '#160E2C']}
        locations={[0, 0.45, 0.78, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: groundY }}
      />

      {starPositions.map((st, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: st.x, top: st.yFrac * groundY, width: st.size, height: st.size, borderRadius: st.size, backgroundColor: '#FFFFFF', opacity: st.opacity }}
        />
      ))}

      <LinearGradient
        colors={['rgba(139,108,246,0)', 'rgba(139,108,246,0.10)', 'rgba(212,169,96,0.10)']}
        locations={[0, 0.6, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: groundY - HORIZON_GLOW, height: HORIZON_GLOW }}
      />

      <FarLayer offset={bgOffset} color={pal.crystal3} bottom={horizonBottom} />
      <MidLayer offset={midOffset} bottleColor={pal.bottle} capColor={pal.cap} crystalColor={pal.crystal2} bottom={horizonBottom} />
    </View>
  );
}

export default memo(RunnerBackground);
