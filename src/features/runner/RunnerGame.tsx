// src/features/runner/RunnerGame.tsx — Composant principal du mini-jeu

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, AppState } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  useReducedMotion,
  FadeIn,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Ionicons from '@react-native-vector-icons/ionicons';
import { hapticsLight, hapticsSuccess, hapticsError } from '../../services/haptics';
import { getHighScore, setHighScore, getSkinForScore, unlockSkin, getUnlockedSkins } from './runner-storage';
import { SKINS } from './runner-storage';
import { useRunnerLoop } from './useRunnerLoop';
import RunnerBackground from './RunnerBackground';
import RunnerGround from './RunnerGround';
import RunnerBottle from './RunnerBottle';
import RunnerObstacles from './RunnerObstacles';
import RunnerPickups from './RunnerPickups';
import RunnerSpeedLines from './RunnerSpeedLines';
import { useRunnerSounds } from './runner-sounds';
import {
  type GameDimensions,
  JUMP_VELOCITY,
  DOUBLE_JUMP_VELOCITY,
  PALETTES,
} from './runner-types';

interface Props {
  onClose: () => void;
}

const MILESTONES = [500, 1000, 2000, 3000];

function getStyles() {
  return {
    container: {
      ...StyleSheet.absoluteFill,
      backgroundColor: '#0B0712',
      zIndex: 9999,
    },
    scoreContainer: {
      position: 'absolute' as const,
      top: 60,
      right: 24,
      alignItems: 'flex-end' as const,
      zIndex: 50,
    },
    scoreText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 22,
      color: '#D4A960',
      fontVariant: ['tabular-nums'] as never,
    },
    hiLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#988EA8',
      marginTop: 2,
    },
    closeBtn: {
      position: 'absolute' as const,
      top: 55,
      left: 16,
      width: 36,
      height: 36,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      zIndex: 100,
    },

    startOverlay: {
      ...StyleSheet.absoluteFill,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    title: {
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 32,
      color: '#D4A960',
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: '#988EA8',
      letterSpacing: 1.5,
      textTransform: 'uppercase' as const,
    },
    tapLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      color: '#8B6CF6',
      marginTop: 36,
    },
    hint: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#988EA8',
      marginTop: 8,
      textAlign: 'center' as const,
    },
    startHiLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#988EA8',
      marginTop: 20,
    },
    startHiScore: {
      fontFamily: 'Inter_700Bold',
      fontSize: 14,
      color: '#D4A960',
      fontVariant: ['tabular-nums'] as never,
    },
    goOverlay: {
      ...StyleSheet.absoluteFill,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      backgroundColor: 'rgba(11,7,18,0.75)',
    },
    goTitle: {
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 28,
      color: '#EDE8F5',
      marginBottom: 8,
    },
    goScore: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 44,
      color: '#D4A960',
      fontVariant: ['tabular-nums'] as never,
    },
    goHiLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: '#988EA8',
      marginTop: 4,
    },
    recordBadge: {
      backgroundColor: '#D4A960',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 8,
      marginTop: 8,
    },
    recordText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: '#1F1A2E',
    },
    retryBtn: {
      backgroundColor: '#8B6CF6',
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 28,
    },
    retryText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
      color: '#FFFFFF',
    },
    quitBtn: {
      marginTop: 14,
      paddingVertical: 12,
      paddingHorizontal: 24,
      alignItems: 'center' as const,
    },
    quitText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: '#988EA8',
    },
    goPickups: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#988EA8',
      marginTop: 12,
    },
    goFlash: {
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 64,
      color: '#D4A960',
    },
  } as const;
}

interface PopupEntry {
  id: number;
  x: number;
  y: number;
  text: string;
}

const MILESTONE_LABELS: Record<number, string> = {
  500: 'Nez confirmé',
  1000: 'Expert olfactif',
  2000: 'Maître parfumeur',
  3000: 'Légende',
};

function FloatingPopup({ entry, onDone }: { entry: PopupEntry; onDone: (id: number) => void }) {
  const opacity = useSharedValue(1);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(0, { duration: 800 });
    ty.value = withTiming(-70, { duration: 800 });
    scale.value = withSequence(
      withSpring(1.3, { damping: 12, stiffness: 300 }),
      withTiming(1, { duration: 500 }),
    );
    const t = setTimeout(() => onDone(entry.id), 850);
    return () => clearTimeout(t);
  }, []);

  const s = useAnimatedStyle(() => ({
    position: 'absolute',
    left: entry.x - 30,
    top: entry.y,
    opacity: opacity.value,
    transform: [{ translateY: ty.value }, { scale: scale.value }],
    minWidth: 60,
    alignItems: 'center',
  }));

  return (
    <Animated.View style={s}>
      <Text allowFontScaling={false} style={{fontFamily:'Inter_800ExtraBold',fontSize:16,color:'#D4A960',textShadowColor:'rgba(0,0,0,0.5)',textShadowOffset:{width:0,height:1},textShadowRadius:3}}>
        {entry.text}
      </Text>
    </Animated.View>
  );
}

export default function RunnerGame({ onClose }: Props) {
  const s = useMemo(() => getStyles(), []);
  const reduceMotion = useReducedMotion();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const dims: GameDimensions = useMemo(() => ({
    width: screenW || 375,
    height: screenH || 812,
    groundY: (screenH || 812) * 0.72,
    bottleX: (screenW || 375) * 0.22,
  }), [screenW, screenH]);

  const {
    bottleY, isJumping, isDoubleJumping, landingTrigger,
    jumpVelocity, canDoubleJump,
    gameState, score, speed,
    obs, pkp,
    bgOffset, midOffset, groundOffset,
    speedLineOffset, palettePhase,
    frameCallback, resetGame,
    lastCollectedDiscount,
    airCombo,
    nearMissTrigger,
    popupTrigger,
    popupBonus,
  } = useRunnerLoop(dims);

  const [uiState, setUiState] = useState('idle');
  const [displayScore, setDisplayScore] = useState(0);
  const lastFloorShared = useSharedValue(0);
  const [highScore, setHighScoreState] = useState(0);
  const [isRecord, setIsRecord] = useState(false);
  const [collectedText, setCollectedText] = useState('');

  const [countdown, setCountdown] = useState(-1);
  const countdownScale = useSharedValue(1);

  const sounds = useRunnerSounds();

  const collectedCounts = useMemo(() => ({ 10: 0, 20: 0, 30: 0, 50: 0 } as Record<number, number>), []);
  const [popups, setPopups] = useState<PopupEntry[]>([]);
  const popupIdRef = useRef(0);

  const [milestone, setMilestone] = useState('');
  const milestoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [skin, setSkin] = useState<typeof SKINS[number]>(SKINS[0]);
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [showGo, setShowGo] = useState(false);

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  // Score chase
  const targetScoreRef = useRef(0);
  const displayScoreRef = useRef(0);
  const chaseRafRef = useRef<number | null>(null);

  const startChase = useCallback(() => {
    if (chaseRafRef.current !== null) return;
    const chase = () => {
      const target = targetScoreRef.current;
      const current = displayScoreRef.current;
      const gap = target - current;
      if (Math.abs(gap) < 0.6) {
        displayScoreRef.current = target;
        setDisplayScore(Math.round(target));
        chaseRafRef.current = null;
        return;
      }
      const step = Math.sign(gap) * Math.max(1.2, Math.abs(gap) * 0.25);
      displayScoreRef.current += step;
      const newFloor = Math.floor(displayScoreRef.current);
      if (newFloor !== Math.floor(current)) {
        setDisplayScore(newFloor);
      }
      chaseRafRef.current = requestAnimationFrame(chase);
    };
    chaseRafRef.current = requestAnimationFrame(chase);
  }, []);

  const updateScoreTarget = useCallback((floor: number) => {
    targetScoreRef.current = floor;
    startChase();
  }, [startChase]);

  const stopChase = useCallback(() => {
    if (chaseRafRef.current !== null) {
      cancelAnimationFrame(chaseRafRef.current);
      chaseRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    getHighScore().then(v => setHighScoreState(v)).catch(() => {});
    getUnlockedSkins().then(keys => {
      const best = [...keys].sort((a, b) => {
        const sa = SKINS.find(sk => sk.key === a);
        const sb = SKINS.find(sk => sk.key === b);
        return (sb?.threshold ?? 0) - (sa?.threshold ?? 0);
      })[0];
      const found = SKINS.find(sk => sk.key === best);
      if (found) setSkin(found);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    if (countdown === 1) {
      const t = setTimeout(() => {
        gameState.value = 'playing';
        jumpVelocity.value = JUMP_VELOCITY;
        isJumping.value = true;
        setCountdown(-1);
        setShowGo(true);
        countdownScale.value = withSpring(1, { damping: 12, stiffness: 300 });
        setTimeout(() => setShowGo(false), 500);
      }, 400);
      return () => clearTimeout(t);
    }
    countdownScale.value = 1.4;
    countdownScale.value = withSpring(1, { damping: 12, stiffness: 300 });
    const t = setTimeout(() => setCountdown(c => c - 1), 400);
    return () => clearTimeout(t);
  }, [countdown]);

  useAnimatedReaction(
    () => gameState.value,
    (state) => {
      scheduleOnRN(setUiState, state);
      if (state === 'dying') {
        scheduleOnRN(hapticsError);
        scheduleOnRN(sounds.playDeath);
        if (!reduceMotion) {
          shakeX.value = withSequence(
            withTiming(7, { duration: 35 }),
            withTiming(-6, { duration: 50 }),
            withTiming(5, { duration: 40 }),
            withTiming(-4, { duration: 55 }),
            withTiming(2, { duration: 45 }),
            withTiming(0, { duration: 90 }),
          );
        }
      }
    },
  );

  const handleMilestone = useCallback((label: string) => {
    setMilestone(label);
    if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
    milestoneTimer.current = setTimeout(() => setMilestone(''), 2000);
  }, []);

  const lastMilestoneShared = useSharedValue(0);

  useAnimatedReaction(
    () => score.value,
    () => {
      const floor = Math.floor(score.value);
      if (floor !== lastFloorShared.value) {
        lastFloorShared.value = floor;
        scheduleOnRN(updateScoreTarget, floor);
        for (const m of MILESTONES) {
          if (floor >= m && lastMilestoneShared.value < m) {
            lastMilestoneShared.value = m;
            scheduleOnRN(handleMilestone, MILESTONE_LABELS[m] ?? '');
            break;
          }
        }
      }
    },
  );

  const handlePopupTrigger = useCallback((bonus: number) => {
    const id = ++popupIdRef.current;
    setPopups(prev => [...prev, { id, x: dims.bottleX, y: dims.groundY - 120, text: `+${bonus}` }]);
  }, []);

  useAnimatedReaction(
    () => popupTrigger.value,
    () => {
      const bonus = popupBonus.value;
      if (bonus > 0) {
        scheduleOnRN(handlePopupTrigger, bonus);
      }
    },
  );

  useAnimatedReaction(
    () => palettePhase.value,
    (phase) => {
      const idx = phase % PALETTES.length;
      scheduleOnRN(setPaletteIdx, idx);
    },
  );

  const onPickupCollected = useCallback((discount: number) => {
    collectedCounts[discount] = (collectedCounts[discount] || 0) + 1;
    hapticsSuccess();
    sounds.playPickup();
  }, [collectedCounts, sounds]);

  useAnimatedReaction(
    () => lastCollectedDiscount.value,
    (discount) => {
      if (discount > 0) {
        scheduleOnRN(onPickupCollected, discount);
        lastCollectedDiscount.value = 0;
      }
    },
  );

  useEffect(() => {
    frameCallback.setActive(true);
    return () => {
      frameCallback.setActive(false);
      stopChase();
    };
  }, [frameCallback]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') frameCallback.setActive(true);
      else frameCallback.setActive(false);
    });
    return () => sub.remove();
  }, [frameCallback]);

  // Finalize score on game over
  useEffect(() => {
    if (uiState === 'gameover') {
      stopChase();
      const finalScore = lastFloorShared.value;
      setDisplayScore(finalScore);
      displayScoreRef.current = finalScore;
      targetScoreRef.current = finalScore;

      const parts: string[] = [];
      if (collectedCounts[10]) parts.push(`${collectedCounts[10]}× −10%`);
      if (collectedCounts[20]) parts.push(`${collectedCounts[20]}× −20%`);
      if (collectedCounts[30]) parts.push(`${collectedCounts[30]}× −30%`);
      if (collectedCounts[50]) parts.push(`${collectedCounts[50]}× −50%`);
      setCollectedText(parts.length > 0 ? `Réduc' collectées : ${parts.join(', ')}` : '');

      if (finalScore > highScore) {
        setHighScoreState(finalScore);
        setIsRecord(true);
        setHighScore(finalScore).catch(() => {});
        sounds.playRecord();
      }
      const newSkin = getSkinForScore(finalScore);
      setSkin(newSkin);
      unlockSkin(newSkin.key).catch(() => {});
    }
  }, [uiState, highScore, collectedCounts]);

  const handleRestart = useCallback(() => {
    stopChase();
    resetGame();
    lastFloorShared.value = 0;
    targetScoreRef.current = 0;
    displayScoreRef.current = 0;
    setDisplayScore(0);
    collectedCounts[10] = 0;
    collectedCounts[20] = 0;
    collectedCounts[30] = 0;
    collectedCounts[50] = 0;
    setIsRecord(false);
    setCollectedText('');
    setPopups([]);
    setCountdown(-1);
    setMilestone('');
    lastMilestoneShared.value = 0;
    shakeX.value = 0;
    setPaletteIdx(0);
    setShowGo(false);
  }, [resetGame, stopChase]);

  const handlePopupDone = useCallback((id: number) => {
    setPopups(prev => prev.filter(p => p.id !== id));
  }, []);

  const startCountdown = useCallback(() => setCountdown(3), []);

  const tapGesture = useMemo(() =>
    Gesture.Tap()
      .onEnd(() => {
        'worklet';
        const state = gameState.value;
        if (state === 'idle') {
          scheduleOnRN(startCountdown);
          return;
        }
        if (state === 'playing') {
          if (!isJumping.value) {
            jumpVelocity.value = JUMP_VELOCITY;
            isJumping.value = true;
            scheduleOnRN(hapticsLight);
            scheduleOnRN(sounds.playJump);
            return;
          }
          if (canDoubleJump.value) {
            jumpVelocity.value = DOUBLE_JUMP_VELOCITY;
            canDoubleJump.value = false;
            isDoubleJumping.value = true;
            scheduleOnRN(hapticsLight);
            scheduleOnRN(sounds.playJump);
            return;
          }
          return;
        }
      }),
    [],
  );

  const showStart = uiState === 'idle' || uiState === 'entering';
  const showGameOver = uiState === 'gameover';

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View style={[s.container, shakeStyle]}>
        <RunnerBackground bgOffset={bgOffset} midOffset={midOffset} paletteIdx={paletteIdx} />
        <RunnerGround groundOffset={groundOffset} groundY={dims.groundY} screenW={screenW} />

        <RunnerSpeedLines speed={speed} speedLineOffset={speedLineOffset} groundY={dims.groundY} />

        <RunnerBottle
          bottleX={dims.bottleX}
          bottleY={bottleY}
          isJumping={isJumping}
          isDoubleJumping={isDoubleJumping}
          landingTrigger={landingTrigger}
          gameState={gameState}
          bottleColor={skin.bottle}
          capColor={skin.cap}
          reduceMotion={reduceMotion}
          groundY={dims.groundY}
        />

        <RunnerObstacles obs={obs} groundY={dims.groundY} paletteIdx={paletteIdx} />
        <RunnerPickups pkp={pkp} reduceMotion={reduceMotion} />

        <View style={s.scoreContainer}>
          <Text allowFontScaling={false} style={s.scoreText}>
            {displayScore}
          </Text>
          {highScore > 0 && (
            <Text allowFontScaling={false} style={s.hiLabel}>
              Record: {isRecord ? displayScore : highScore}
            </Text>
          )}
        </View>

        <Pressable
          style={s.closeBtn}
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Fermer le jeu"
        >
          <Ionicons name="close-outline" size={20} color="#988EA8" />
        </Pressable>

        {popups.map(p => (
          <FloatingPopup key={p.id} entry={p} onDone={handlePopupDone} />
        ))}

        {milestone !== '' && (
          <View style={{ position: 'absolute', top: dims.groundY * 0.45, left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
            <Text allowFontScaling={false} style={{ fontFamily: 'PlayfairDisplay_700Bold', fontSize: 26, color: '#D4A960', textShadowColor: 'rgba(212,169,96,0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }}>
              {milestone}
            </Text>
          </View>
        )}

        {showStart && (
          <View style={s.startOverlay} pointerEvents="none">
            {countdown > 0 ? (
              <>
                <Animated.View style={{ transform: [{ scale: countdownScale }] }}>
                  <Text allowFontScaling={false} style={[s.goScore, { fontSize: 72 }]}>{countdown}</Text>
                </Animated.View>
              </>
            ) : (
              <>
                <Text style={s.title}>Flacon Runner</Text>
                <Text style={s.subtitle}>Esquive les cristaux</Text>
                <Text style={s.tapLabel}>Tape pour jouer</Text>
                <Text style={s.hint}>
                  Tap = saut{'\n'}Double tap = double saut{'\n'}Enchaînement aérien = combo{'\n'}Attrape les réductions
                </Text>
                {highScore > 0 && (
                  <>
                    <Text style={s.startHiLabel}>Record</Text>
                    <Text allowFontScaling={false} style={s.startHiScore}>{highScore}</Text>
                  </>
                )}
              </>
            )}
          </View>
        )}

        {showGameOver && (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(300)} style={s.goOverlay}>
            <Text style={s.goTitle}>Flacon brisé</Text>
            <Text allowFontScaling={false} style={s.goScore}>{displayScore}</Text>
            {isRecord && (
              <View style={s.recordBadge}>
                <Text allowFontScaling={false} style={s.recordText}>Nouveau record !</Text>
              </View>
            )}
            <Text style={s.goHiLabel}>Record: {Math.max(highScore, displayScore)}</Text>
            {collectedText ? (
              <Text style={s.goPickups}>{collectedText}</Text>
            ) : null}
            <Pressable style={s.retryBtn} onPress={handleRestart}>
              <Text style={s.retryText}>Rejouer</Text>
            </Pressable>
            <Pressable style={s.quitBtn} onPress={onClose} hitSlop={8}>
              <Text style={s.quitText}>Quitter</Text>
            </Pressable>
          </Animated.View>
        )}

        {showGo && (
          <View style={s.startOverlay} pointerEvents="none">
            <Animated.Text entering={reduceMotion ? undefined : FadeIn.duration(150)} style={s.goFlash}>GO</Animated.Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}
