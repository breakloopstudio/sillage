// src/features/runner/RunnerBackground.tsx — 3 couches parallaxe seamless

import { useMemo, memo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { PALETTES } from './runner-types';

interface Props {
  bgOffset: SharedValue<number>;
  midOffset: SharedValue<number>;
  paletteIdx: number;
}

const FAR_PERIOD = 1200;
const MID_PERIOD = 1400;
const SKY_BANDS = ['#0B0712', '#10091C', '#0D0818', '#120A1F', '#0B0712'];

function FarLayer({ offset, hillColor }: { offset: SharedValue<number>; hillColor: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -(offset.value % FAR_PERIOD) }],
  }));

  const hills = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      left: i * 200 + 20,
      width: 180,
      height: 40 + (i % 2) * 30,
    })),
    [],
  );

  return (
    <Animated.View style={[{ position: 'absolute', top: '55%', height: '15%', width: FAR_PERIOD * 2, flexDirection: 'row' }, style]}>
      {[0, FAR_PERIOD].map(shift => (
        <View key={shift} style={{ width: FAR_PERIOD, height: '100%', position: 'relative' }}>
          {hills.map((h, j) => (
            <View
              key={j}
              style={{
                position: 'absolute', left: h.left, bottom: 0,
                width: h.width, height: h.height,
                backgroundColor: hillColor, borderTopLeftRadius: 90, borderTopRightRadius: 90,
                opacity: 0.6,
              }}
            />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

function MidLayer({ offset, shelfColor, flaconColor }: { offset: SharedValue<number>; shelfColor: string; flaconColor: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -(offset.value % MID_PERIOD) }],
  }));

  const shelves = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => ({ left: i * 200 + 20, width: 200 + (i % 3) * 60 })),
    [],
  );

  const flacons = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => ({
      left: i * 200 + 40 + (i % 3) * 30,
      width: 14 + (i % 2) * 6,
      height: 28 + (i % 3) * 12,
    })),
    [],
  );

  return (
    <Animated.View style={[{ position: 'absolute', top: '62%', height: '12%', width: MID_PERIOD * 2, flexDirection: 'row' }, style]}>
      {[0, MID_PERIOD].map(shift => (
        <View key={shift} style={{ width: MID_PERIOD, height: '100%', position: 'relative' }}>
          {shelves.map((sh, j) => (
            <View
              key={`sh${j}`}
              style={{ position: 'absolute', left: sh.left, bottom: 0, width: sh.width, height: 6, backgroundColor: shelfColor, opacity: 0.4 }}
            />
          ))}
          {flacons.map((f, j) => (
            <View
              key={`fl${j}`}
              style={{
                position: 'absolute', left: f.left, bottom: 6, width: f.width, height: f.height,
                backgroundColor: flaconColor, borderTopLeftRadius: 3, borderTopRightRadius: 3, opacity: 0.35,
              }}
            />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

function RunnerBackground({ bgOffset, midOffset, paletteIdx }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const pal = PALETTES[paletteIdx % PALETTES.length];

  const starPositions = useMemo(() =>
    Array.from({ length: 40 }, () => ({
      x: Math.random() * screenW,
      y: Math.random() * screenH * 0.65,
      size: 1 + Math.random() * 2,
      opacity: 0.2 + Math.random() * 0.6,
    })),
    [screenW, screenH],
  );

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {starPositions.map((st, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: st.x, top: st.y, width: st.size, height: st.size, borderRadius: st.size, backgroundColor: '#FFFFFF', opacity: st.opacity }}
        />
      ))}

      <FarLayer offset={bgOffset} hillColor={pal.crystal2} />
      <MidLayer offset={midOffset} shelfColor={pal.crystal3} flaconColor={pal.crystal} />

      {SKY_BANDS.map((color, i) => (
        <View
          key={`sky${i}`}
          style={{ position: 'absolute', top: `${i * 20}%`, left: 0, right: 0, height: '22%', backgroundColor: color, opacity: 0.3 }}
        />
      ))}
    </View>
  );
}

export default memo(RunnerBackground);
