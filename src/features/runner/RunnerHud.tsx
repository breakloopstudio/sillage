// src/features/runner/RunnerHud.tsx — Indicateurs de pouvoirs actifs (UI thread)

import { memo } from 'react';
import { View, Text } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { PICKUP_DEFS, POWER_DURATION, FEVER_DURATION, FEVER_MAX, type PowerType } from './runner-types';

interface Props {
  gameTime: SharedValue<number>;
  shieldActive: SharedValue<boolean>;
  magnetUntil: SharedValue<number>;
  doubleUntil: SharedValue<number>;
  slowUntil: SharedValue<number>;
  feverGauge: SharedValue<number>;
  feverUntil: SharedValue<number>;
  topInset?: number;
}

const BAR_W = 30;
const FEVER_BAR_W = 120;

function defByPower(p: PowerType) {
  return PICKUP_DEFS.find(d => d.power === p) ?? PICKUP_DEFS[0];
}

function TimedChip({ until, gameTime, power }: { until: SharedValue<number>; gameTime: SharedValue<number>; power: PowerType }) {
  const def = defByPower(power);
  const dur = POWER_DURATION[power];
  const wrap = useAnimatedStyle(() => ({
    opacity: gameTime.value < until.value ? 1 : 0,
  }));
  const fill = useAnimatedStyle(() => {
    const ratio = Math.max(0, Math.min(1, (until.value - gameTime.value) / dur));
    return { width: BAR_W * ratio };
  });
  return (
    <Animated.View style={[{ alignItems: 'center', gap: 3 }, wrap]}>
      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: def.color, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' }}>
        <Text allowFontScaling={false} style={{ fontSize: 15 }}>{def.emoji}</Text>
      </View>
      <View style={{ width: BAR_W, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
        <Animated.View style={[{ height: 3, borderRadius: 1.5, backgroundColor: def.color }, fill]} />
      </View>
    </Animated.View>
  );
}

function ShieldChip({ shieldActive }: { shieldActive: SharedValue<boolean> }) {
  const def = defByPower('shield');
  const wrap = useAnimatedStyle(() => ({ opacity: shieldActive.value ? 1 : 0 }));
  return (
    <Animated.View style={[{ alignItems: 'center', gap: 3 }, wrap]}>
      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: def.color, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' }}>
        <Text allowFontScaling={false} style={{ fontSize: 15 }}>{def.emoji}</Text>
      </View>
      <View style={{ width: BAR_W, height: 3, borderRadius: 1.5, backgroundColor: def.color }} />
    </Animated.View>
  );
}

function FeverBar({ feverGauge, feverUntil, gameTime }: { feverGauge: SharedValue<number>; feverUntil: SharedValue<number>; gameTime: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => {
    const active = gameTime.value < feverUntil.value;
    const ratio = active
      ? Math.max(0, Math.min(1, (feverUntil.value - gameTime.value) / FEVER_DURATION))
      : Math.max(0, Math.min(1, feverGauge.value / FEVER_MAX));
    return {
      width: FEVER_BAR_W * ratio,
      backgroundColor: active ? '#D4A960' : '#8B6CF6',
    };
  });
  const wrap = useAnimatedStyle(() => {
    const active = gameTime.value < feverUntil.value;
    return { opacity: active || feverGauge.value > 0 ? 1 : 0 };
  });
  return (
    <Animated.View style={[{ width: FEVER_BAR_W, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }, wrap]}>
      <Animated.View style={[{ height: 5, borderRadius: 2.5 }, fill]} />
    </Animated.View>
  );
}

function RunnerHud({ gameTime, shieldActive, magnetUntil, doubleUntil, slowUntil, feverGauge, feverUntil, topInset = 0 }: Props) {
  return (
    <View
      style={{ position: 'absolute', top: topInset + 56, left: 0, right: 0, alignItems: 'center', gap: 8, zIndex: 40 }}
      pointerEvents="none"
      accessibilityElementsHidden
    >
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
        <TimedChip until={magnetUntil} gameTime={gameTime} power="magnet" />
        <ShieldChip shieldActive={shieldActive} />
        <TimedChip until={doubleUntil} gameTime={gameTime} power="double" />
        <TimedChip until={slowUntil} gameTime={gameTime} power="slow" />
      </View>
      <FeverBar feverGauge={feverGauge} feverUntil={feverUntil} gameTime={gameTime} />
    </View>
  );
}

export default memo(RunnerHud);
