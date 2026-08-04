// src/features/runner/RunnerGame.tsx — Composant principal du mini-jeu

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, AppState, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useTranslation } from 'react-i18next';
import { hapticsLight, hapticsSuccess, hapticsError } from '../../services/haptics';
import { useAuthContext } from '../../contexts/AuthContext';
import { submitRunnerScore, clearRunnerLeaderboardCache } from '../../services/runner';
import { searchParfumsCached } from '../../services/catalog';
import type { Parfum } from '../../models';
import { runnerShareUrl } from '../../utils/share';
import {
  getHighScore, setHighScore, getSkinsForScore, unlockSkins, getUnlockedSkins,
  getSelectedSkinKey, setSelectedSkinKey, getMuted, setMuted,
} from './runner-storage';
import { SKINS } from './runner-storage';
import { useRunnerLoop } from './useRunnerLoop';
import RunnerBackground from './RunnerBackground';
import RunnerGround from './RunnerGround';
import RunnerBottle from './RunnerBottle';
import RunnerObstacles from './RunnerObstacles';
import RunnerPickups from './RunnerPickups';
import RunnerSpeedLines from './RunnerSpeedLines';
import RunnerParticles from './RunnerParticles';
import RunnerHud from './RunnerHud';
import { useRunnerSounds } from './runner-sounds';
import {
  getMissionTiers, saveMissionTiers, evaluateMissionTiers, nextObjective,
  type FreshTier, type NextObjective, type MissionContext,
} from './runner-missions';
import { recordRun, totalNotes } from './runner-stats';
import { getDailyChallenge, isDailyDone, markDailyDone, type DailyChallenge } from './runner-daily';
import {
  type GameDimensions,
  JUMP_VELOCITY,
  DOUBLE_JUMP_VELOCITY,
  PALETTES,
  PICKUP_DEFS,
  PX_PER_METER,
  MAX_LIVES,
} from './runner-types';

interface Props {
  onClose: () => void;
}

// Mapping des notes collectées (clés pickups) vers les noms de notes du catalogue (EN),
// pour suggérer un vrai parfum dont l'accord ressemble à la course.
const NOTE_QUERY: Record<string, string> = {
  bergamote: 'bergamot',
  santal: 'sandalwood',
  ambre: 'amber',
  musc: 'musk',
};

function getStyles(topInset: number, bottomInset: number) {
  return {
    container: {
      ...StyleSheet.absoluteFill,
      backgroundColor: '#0B0712',
      zIndex: 9999,
    },
    scoreContainer: {
      position: 'absolute' as const,
      top: topInset + 12,
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
    livesRow: {
      position: 'absolute' as const,
      top: topInset + 58,
      right: 26,
      flexDirection: 'row' as const,
      gap: 5,
      zIndex: 50,
    },
    topCluster: {
      position: 'absolute' as const,
      top: topInset + 8,
      left: 12,
      flexDirection: 'row' as const,
      gap: 6,
      zIndex: 300,
    },
    topBtn: {
      width: 36,
      height: 36,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },

    startOverlay: {
      ...StyleSheet.absoluteFill,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      zIndex: 200,
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
    skinRow: {
      flexDirection: 'row' as const,
      gap: 14,
      marginTop: 28,
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
      paddingBottom: bottomInset + 24,
      zIndex: 200,
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
    nextObjRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      marginTop: 8,
    },
    nextObjText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
      color: '#988EA8',
      fontVariant: ['tabular-nums'] as never,
    },
    dailyCard: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      marginTop: 24,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: 'rgba(212,169,96,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(212,169,96,0.3)',
    },
    dailyCardText: {
      flex: 1,
    },
    dailyOverline: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 9,
      color: '#D4A960',
      letterSpacing: 1.2,
      textTransform: 'uppercase' as const,
    },
    dailyLabel: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: '#EDE8F5',
      marginTop: 2,
    },
    dailyDoneBadge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      backgroundColor: '#2DD4BF',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginTop: 8,
    },
    dailyDoneText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: '#1F1A2E',
    },
    suggestedCard: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      marginTop: 14,
      padding: 10,
      borderRadius: 12,
      backgroundColor: '#15101E',
      borderWidth: 1,
      borderColor: 'rgba(212,169,96,0.3)',
      width: 280,
    },
    suggestedImg: {
      width: 44,
      height: 58,
      borderRadius: 6,
      backgroundColor: '#1D1728',
    },
    suggestedText: {
      flex: 1,
    },
    suggestedOverline: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 9,
      color: '#D4A960',
      letterSpacing: 1.2,
      textTransform: 'uppercase' as const,
    },
    suggestedName: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 14,
      color: '#EDE8F5',
      marginTop: 2,
    },
    suggestedBrand: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: '#988EA8',
      marginTop: 1,
    },
    goStats: {
      flexDirection: 'row' as const,
      gap: 28,
      marginTop: 16,
    },
    goStat: {
      alignItems: 'center' as const,
      gap: 2,
    },
    goStatNum: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 20,
      color: '#EDE8F5',
      fontVariant: ['tabular-nums'] as never,
    },
    goStatLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 10,
      color: '#988EA8',
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
    },
    newSkinBadge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      backgroundColor: '#D4A960',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginTop: 10,
    },
    newSkinText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: '#1F1A2E',
    },
    missionBadge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      backgroundColor: 'rgba(212,169,96,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(212,169,96,0.4)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginTop: 8,
    },
    missionText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: '#D4A960',
    },
    rankText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: '#8B6CF6',
      marginTop: 12,
      fontVariant: ['tabular-nums'] as never,
    },
    shareBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 6,
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 24,
      borderWidth: 1,
      borderColor: 'rgba(212,169,96,0.5)',
      borderRadius: 12,
    },
    shareText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: '#D4A960',
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
  combo: number;
}

function FloatingPopup({ entry, onDone, reduceMotion }: { entry: PopupEntry; onDone: (id: number) => void; reduceMotion: boolean }) {
  const opacity = useSharedValue(1);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const combo = entry.combo;
  const peak = 1.15 + Math.min(combo, 4) * 0.12;
  const fontSize = 15 + Math.min(combo, 4) * 2;

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = withTiming(0, { duration: 150 });
    } else {
      opacity.value = withTiming(0, { duration: 800 });
      ty.value = withTiming(-70, { duration: 800 });
      scale.value = withSequence(
        withSpring(peak, { damping: 12, stiffness: 300 }),
        withTiming(1, { duration: 500 }),
      );
    }
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
      <Text allowFontScaling={false} style={{fontFamily:'Inter_800ExtraBold',fontSize,color:'#D4A960',textShadowColor:'rgba(0,0,0,0.5)',textShadowOffset:{width:0,height:1},textShadowRadius:3}}>
        {entry.text}
      </Text>
      {combo > 1 && (
        <Text allowFontScaling={false} style={{fontFamily:'Inter_800ExtraBold',fontSize:13,color:'#8B6CF6',textShadowColor:'rgba(0,0,0,0.5)',textShadowOffset:{width:0,height:1},textShadowRadius:3}}>
          ×{combo}
        </Text>
      )}
    </Animated.View>
  );
}

function SkinSwatch({ def, unlocked, selected, onSelect }: { def: typeof SKINS[number]; unlocked: boolean; selected: boolean; onSelect: (key: string) => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => { if (unlocked) onSelect(def.key); }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={unlocked ? t('runner.skinA11y', { label: def.label }) : t('runner.skinA11yLocked', { label: def.label, threshold: def.threshold })}
      style={{ alignItems: 'center', gap: 4, opacity: unlocked ? 1 : 0.45 }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#15101E', borderWidth: 2, borderColor: selected ? '#D4A960' : 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
        <View style={{ width: 16, height: 22, backgroundColor: def.bottle, borderRadius: 3 }} />
        <View style={{ position: 'absolute', top: 7, width: 8, height: 5, backgroundColor: def.cap, borderRadius: 2 }} />
        {!unlocked && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(11,7,18,0.6)' }}>
            <Ionicons name="lock-closed-outline" size={13} color="#988EA8" />
          </View>
        )}
      </View>
      <Text allowFontScaling={false} style={{ fontFamily: 'Inter_500Medium', fontSize: 9, color: selected ? '#D4A960' : '#988EA8' }}>
        {unlocked ? def.label : `${def.threshold}`}
      </Text>
    </Pressable>
  );
}

export default function RunnerGame({ onClose }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => getStyles(insets.top, insets.bottom), [insets.top, insets.bottom]);
  const reduceMotion = useReducedMotion();
  const { isAuthenticated } = useAuthContext();
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
    lastCollectedPickup,
    popupTrigger,
    popupBonus,
    popupCombo,
    distance,
    maxCombo,
    nearMissCount,
    collectBurstTrigger,
    gameTime,
    shieldActive,
    magnetUntil,
    doubleUntil,
    slowUntil,
    shieldBreakTrigger,
    lives,
    invulnUntil,
    crackTrigger,
    lastTapTime,
    bufferJumpTrigger,
    feverGauge,
    feverUntil,
    feverStartTrigger,
    pickupCounts,
  } = useRunnerLoop(dims);

  const [uiState, setUiState] = useState('idle');
  const [displayScore, setDisplayScore] = useState(0);
  const lastFloorShared = useSharedValue(0);
  const [highScore, setHighScoreState] = useState(0);
  const [isRecord, setIsRecord] = useState(false);
  const [collectedText, setCollectedText] = useState('');

  const [countdown, setCountdown] = useState(-1);
  const countdownScale = useSharedValue(1);
  const goTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sounds = useRunnerSounds();
  const mutedRef = useRef(false);
  const playJump = useCallback(() => { if (!mutedRef.current) sounds.playJump(); }, [sounds]);
  const playPickup = useCallback(() => { if (!mutedRef.current) sounds.playPickup(); }, [sounds]);
  const playDeath = useCallback(() => { if (!mutedRef.current) sounds.playDeath(); }, [sounds]);
  const playRecord = useCallback(() => { if (!mutedRef.current) sounds.playRecord(); }, [sounds]);
  const playCrack = useCallback(() => { if (!mutedRef.current) sounds.playCrack(); }, [sounds]);

  const [muted, setMutedState] = useState(false);
  const toggleMute = useCallback(() => {
    setMutedState(prev => {
      const next = !prev;
      mutedRef.current = next;
      setMuted(next).catch(() => {});
      return next;
    });
  }, []);

  const [popups, setPopups] = useState<PopupEntry[]>([]);
  const popupIdRef = useRef(0);

  const [unlockedKeys, setUnlockedKeys] = useState<string[]>(['default']);
  const [selectedKey, setSelectedKeyState] = useState<string>('default');
  const skin = useMemo(() => SKINS.find(sk => sk.key === selectedKey) ?? SKINS[0], [selectedKey]);
  const selectSkin = useCallback((key: string) => {
    setSelectedKeyState(key);
    setSelectedSkinKey(key).catch(() => {});
    hapticsLight();
  }, []);

  const [paletteIdx, setPaletteIdx] = useState(0);
  const [showGo, setShowGo] = useState(false);
  const [finalStats, setFinalStats] = useState({ distance: 0, maxCombo: 0, nearMiss: 0 });
  const [newSkinLabels, setNewSkinLabels] = useState<string[]>([]);
  const [freshTiers, setFreshTiers] = useState<FreshTier[]>([]);
  const [nextObj, setNextObj] = useState<NextObjective | null>(null);

  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
  const [dailyDone, setDailyDone] = useState(false);
  const [dailyJustDone, setDailyJustDone] = useState(false);
  const dailyChallengeRef = useRef<DailyChallenge | null>(null);
  const dailyDoneRef = useRef(false);

  const [suggestedParfum, setSuggestedParfum] = useState<Parfum | null>(null);
  const [worldRank, setWorldRank] = useState<number | null>(null);
  const [livesDisplay, setLivesDisplay] = useState(3);
  const shieldBreaksRef = useRef(0);

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
    getMuted().then(m => { mutedRef.current = m; setMutedState(m); }).catch(() => {});
    const ch = getDailyChallenge();
    dailyChallengeRef.current = ch;
    setDailyChallenge(ch);
    isDailyDone().then(done => { dailyDoneRef.current = done; setDailyDone(done); }).catch(() => {});
    getUnlockedSkins().then(keys => {
      setUnlockedKeys(keys);
      getSelectedSkinKey().then(saved => {
        if (saved && keys.includes(saved)) {
          setSelectedKeyState(saved);
          return;
        }
        const best = [...keys].sort((a, b) => {
          const sa = SKINS.find(sk => sk.key === a);
          const sb = SKINS.find(sk => sk.key === b);
          return (sb?.threshold ?? 0) - (sa?.threshold ?? 0);
        })[0];
        if (best) setSelectedKeyState(best);
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    if (countdown === 1) {
      const t = setTimeout(() => {
        gameState.value = 'playing';
        jumpVelocity.value = JUMP_VELOCITY;
        isJumping.value = true;
        canDoubleJump.value = true;
        setCountdown(-1);
        setShowGo(true);
        if (!reduceMotion) countdownScale.value = withSpring(1, { damping: 12, stiffness: 300 });
        goTimerRef.current = setTimeout(() => setShowGo(false), 500);
      }, 400);
      // Ne nettoie que le tick du countdown : le timer « GO » (goTimerRef) est armé juste
      // avant que `countdown` passe à -1 — le nettoyer ici l'annulerait et le « GO » resterait.
      return () => clearTimeout(t);
    }
    if (reduceMotion) {
      countdownScale.value = 1;
    } else {
      countdownScale.value = 1.4;
      countdownScale.value = withSpring(1, { damping: 12, stiffness: 300 });
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 400);
    return () => clearTimeout(t);
  }, [countdown, reduceMotion, gameState, jumpVelocity, isJumping, canDoubleJump, countdownScale]);

  // Nettoyage du timer « GO » au démontage uniquement.
  useEffect(() => () => {
    if (goTimerRef.current) { clearTimeout(goTimerRef.current); goTimerRef.current = null; }
  }, []);

  useAnimatedReaction(
    () => gameState.value,
    (state) => {
      scheduleOnRN(setUiState, state);
      if (state === 'dying') {
        scheduleOnRN(hapticsError);
        scheduleOnRN(playDeath);
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

  useAnimatedReaction(
    () => score.value,
    () => {
      const floor = Math.floor(score.value);
      if (floor !== lastFloorShared.value) {
        lastFloorShared.value = floor;
        scheduleOnRN(updateScoreTarget, floor);
      }
    },
  );

  const handlePopupTrigger = useCallback((bonus: number, combo: number) => {
    const id = ++popupIdRef.current;
    setPopups(prev => [...prev, { id, x: dims.bottleX, y: dims.groundY - 120, text: `+${bonus}`, combo }]);
  }, [dims]);

  useAnimatedReaction(
    () => popupTrigger.value,
    () => {
      const bonus = popupBonus.value;
      if (bonus > 0) {
        scheduleOnRN(handlePopupTrigger, bonus, popupCombo.value);
      }
    },
  );

  useAnimatedReaction(
    () => palettePhase.value,
    (phase) => {
      scheduleOnRN(setPaletteIdx, phase % PALETTES.length);
    },
  );

  const onPickupCollected = useCallback((typeIdx: number) => {
    if (!PICKUP_DEFS[typeIdx]) return;
    hapticsSuccess();
    playPickup();
  }, [playPickup]);

  useAnimatedReaction(
    () => lastCollectedPickup.value,
    (v) => {
      if (v > 0) {
        scheduleOnRN(onPickupCollected, v - 1);
        lastCollectedPickup.value = 0;
      }
    },
  );

  const onShieldBreak = useCallback(() => {
    shieldBreaksRef.current += 1;
    hapticsSuccess();
  }, []);

  useAnimatedReaction(
    () => shieldBreakTrigger.value,
    (v, prev) => {
      if (prev != null && v !== prev) {
        scheduleOnRN(onShieldBreak);
      }
    },
  );

  const onCrack = useCallback(() => {
    playCrack();
    hapticsError();
    if (!reduceMotion) {
      shakeX.value = withSequence(
        withTiming(4, { duration: 30 }),
        withTiming(-3, { duration: 45 }),
        withTiming(2, { duration: 40 }),
        withTiming(0, { duration: 70 }),
      );
    }
  }, [playCrack, reduceMotion, shakeX]);

  useAnimatedReaction(
    () => crackTrigger.value,
    (v, prev) => {
      if (prev != null && v !== prev) {
        scheduleOnRN(onCrack);
      }
    },
  );

  useAnimatedReaction(
    () => lives.value,
    (v) => {
      scheduleOnRN(setLivesDisplay, v);
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
  const gameOverFinalizedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  useEffect(() => {
    if (uiState !== 'gameover') return;
    if (gameOverFinalizedRef.current) return;
    gameOverFinalizedRef.current = true;
    stopChase();
    const finalScore = lastFloorShared.value;
    setDisplayScore(finalScore);
    displayScoreRef.current = finalScore;
    targetScoreRef.current = finalScore;

    const dist = Math.floor(distance.value / PX_PER_METER);
    const combo = Math.floor(maxCombo.value);
    const nearMiss = Math.floor(nearMissCount.value);
    const shieldBreaks = shieldBreaksRef.current;
    setFinalStats({ distance: dist, maxCombo: combo, nearMiss });

    const notesByType: Record<string, number> = {};
    const parts: string[] = [];
    for (let i = 0; i < PICKUP_DEFS.length; i++) {
      const def = PICKUP_DEFS[i];
      const n = Math.floor(pickupCounts[i].value);
      if (n) { notesByType[def.key] = n; parts.push(`${n}× ${def.label}`); }
    }
    const notesCollected = Object.values(notesByType).reduce((sum, n) => sum + n, 0);
    setCollectedText(parts.length > 0 ? t('runner.composition', { notes: parts.join(', ') }) : '');

    const daily = dailyChallengeRef.current;
    if (daily && !dailyDoneRef.current && daily.check({ score: finalScore, distance: dist, maxCombo: combo, nearMiss, shieldBreaks, notesCollected })) {
      dailyDoneRef.current = true;
      setDailyDone(true);
      setDailyJustDone(true);
      markDailyDone().catch(() => {});
      hapticsSuccess();
    }

    const sortedNotes = Object.entries(notesByType).sort((a, b) => b[1] - a[1]);
    const query = sortedNotes.slice(0, 2).map(([k]) => NOTE_QUERY[k]).filter(Boolean).join(' ');
    if (query) {
      searchParfumsCached(query).then(results => {
        if (mountedRef.current && results.length > 0) setSuggestedParfum(results[0]);
      }).catch(() => {});
    }

    if (finalScore > highScore) {
      setHighScoreState(finalScore);
      setIsRecord(true);
      setHighScore(finalScore).catch(() => {});
      playRecord();
    }

      const earned = getSkinsForScore(finalScore).filter(sk => !unlockedKeys.includes(sk.key));
      if (earned.length > 0) {
        const keys = earned.map(sk => sk.key);
        unlockSkins(keys).catch(() => {});
        setUnlockedKeys(prev => [...new Set([...prev, ...keys])]);
        setNewSkinLabels(earned.map(sk => sk.label));
      } else {
        setNewSkinLabels([]);
      }

    // Carnet (stats lifetime) puis missions à paliers + prochain objectif.
    recordRun({ score: finalScore, distance: dist, maxCombo: combo, nearMiss, shieldBreaks, notesByType })
      .then((stats) => {
        const ctx: MissionContext = {
          score: finalScore, distance: dist, maxCombo: combo, nearMiss, shieldBreaks, notesCollected,
          totalRuns: stats.totalRuns, totalDistance: stats.totalDistance, totalNotes: totalNotes(stats),
        };
        return getMissionTiers().then((tiers) => {
          if (!mountedRef.current) return;
          const fresh = evaluateMissionTiers(ctx, tiers);
          const updated = { ...tiers };
          for (const f of fresh) updated[f.mission.key] = f.tier;
          if (fresh.length > 0) {
            saveMissionTiers(updated).catch(() => {});
            setFreshTiers(fresh);
          } else {
            setFreshTiers([]);
          }
          setNextObj(nextObjective(ctx, updated));
        });
      })
      .catch(() => {});

    if (isAuthenticated) {
      clearRunnerLeaderboardCache();
      submitRunnerScore({ score: finalScore, distance: dist, maxCombo: combo, skin: skin.key })
        .then(rank => { if (rank != null) setWorldRank(rank); }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState]);

  const handleRestart = useCallback(() => {
    stopChase();
    if (goTimerRef.current) { clearTimeout(goTimerRef.current); goTimerRef.current = null; }
    gameOverFinalizedRef.current = false;
    resetGame();
    lastFloorShared.value = 0;
    targetScoreRef.current = 0;
    displayScoreRef.current = 0;
    setDisplayScore(0);
    setIsRecord(false);
    setCollectedText('');
    setLivesDisplay(MAX_LIVES);
    setPopups([]);
    setCountdown(-1);
    shakeX.value = 0;
    setPaletteIdx(0);
    setShowGo(false);
    setFinalStats({ distance: 0, maxCombo: 0, nearMiss: 0 });
    setNewSkinLabels([]);
    setFreshTiers([]);
    setNextObj(null);
    setDailyJustDone(false);
    setSuggestedParfum(null);
    setWorldRank(null);
    shieldBreaksRef.current = 0;
  }, [resetGame, stopChase]);

  const handlePopupDone = useCallback((id: number) => {
    setPopups(prev => prev.filter(p => p.id !== id));
  }, []);

  const handlePause = useCallback(() => {
    gameState.value = 'paused';
    hapticsLight();
  }, [gameState]);

  const handleResume = useCallback(() => {
    gameState.value = 'playing';
    hapticsLight();
  }, [gameState]);

  const handleShare = useCallback(() => {
    hapticsLight();
    Share.share({
      message: t('runner.shareMessage', { score: displayScore, url: runnerShareUrl(displayScore) }),
    }).catch(() => {});
  }, [displayScore, t]);

  const handleOpenSuggested = useCallback(() => {
    if (suggestedParfum) {
      hapticsLight();
      router.push(`/catalog/${suggestedParfum.id}`);
    }
  }, [suggestedParfum, router]);

  const startCountdown = useCallback(() => setCountdown(3), []);

  const tapGesture = useMemo(() => {
    const tap = Gesture.Tap()
      .onEnd(() => {
        'worklet';
        const state = gameState.value;
        if (state === 'playing') {
          if (!isJumping.value) {
            jumpVelocity.value = JUMP_VELOCITY;
            isJumping.value = true;
            scheduleOnRN(hapticsLight);
            scheduleOnRN(playJump);
            return;
          }
          if (canDoubleJump.value) {
            jumpVelocity.value = DOUBLE_JUMP_VELOCITY;
            canDoubleJump.value = false;
            isDoubleJumping.value = true;
            scheduleOnRN(hapticsLight);
            scheduleOnRN(playJump);
            return;
          }
          // En l'air, double saut déjà consommé : on horodate le tap pour le jump buffer
          // (un atterrissage dans les JUMP_BUFFER ms déclenchera un saut automatique).
          lastTapTime.value = gameTime.value;
          return;
        }
      });

    return tap;
  }, [playJump, gameState, isJumping, canDoubleJump, jumpVelocity, isDoubleJumping, lastTapTime, gameTime]);

  // Saut bufferisé déclenché par le loop à l'atterrissage → feedback son + haptique.
  useAnimatedReaction(
    () => bufferJumpTrigger.value,
    (v, prev) => {
      if (prev != null && v !== prev) {
        scheduleOnRN(hapticsLight);
        scheduleOnRN(playJump);
      }
    },
  );

  // Mode Fièvre déclenché (jauge pleine) → son (l'haptique vient du pickup collecté,
  // §2.6 : un seul haptique par geste).
  useAnimatedReaction(
    () => feverStartTrigger.value,
    (v, prev) => {
      if (prev != null && v !== prev) {
        scheduleOnRN(playRecord);
      }
    },
  );

  const showStart = uiState === 'idle';
  const showGameOver = uiState === 'gameover';
  const showPause = uiState === 'paused';

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View style={[s.container, shakeStyle]}>
        <RunnerBackground bgOffset={bgOffset} midOffset={midOffset} paletteIdx={paletteIdx} groundY={dims.groundY} />
        <RunnerGround groundOffset={groundOffset} groundY={dims.groundY} screenW={screenW} />

        <RunnerSpeedLines speed={speed} speedLineOffset={speedLineOffset} groundY={dims.groundY} reduceMotion={reduceMotion} />

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
          shieldActive={shieldActive}
          gameTime={gameTime}
          magnetUntil={magnetUntil}
          doubleUntil={doubleUntil}
          slowUntil={slowUntil}
          lives={lives}
          invulnUntil={invulnUntil}
          feverUntil={feverUntil}
        />

        <RunnerObstacles obs={obs} groundY={dims.groundY} paletteIdx={paletteIdx} screenW={dims.width} />
        <RunnerPickups pkp={pkp} reduceMotion={reduceMotion} screenW={dims.width} />
        <RunnerParticles trigger={collectBurstTrigger} originX={dims.bottleX} bottleY={bottleY} reduceMotion={reduceMotion} />
        {!showStart && !showGameOver && (
          <RunnerHud
            gameTime={gameTime}
            shieldActive={shieldActive}
            magnetUntil={magnetUntil}
            doubleUntil={doubleUntil}
            slowUntil={slowUntil}
            feverGauge={feverGauge}
            feverUntil={feverUntil}
            topInset={insets.top}
          />
        )}

        {!showStart && !showGameOver && (
          <View style={s.scoreContainer}>
            <Text allowFontScaling={false} style={s.scoreText}>
              {displayScore}
            </Text>
            {highScore > 0 && (
              <Text allowFontScaling={false} style={s.hiLabel}>
                Record{' '}: {isRecord ? displayScore : highScore}
              </Text>
            )}
          </View>
        )}

        {!showStart && !showGameOver && (
          <View style={s.livesRow} accessibilityLabel={`Vies : ${livesDisplay} sur ${MAX_LIVES}`}>
            {Array.from({ length: MAX_LIVES }, (_, i) => (
              <Ionicons
                key={i}
                name={i < livesDisplay ? 'flask' : 'flask-outline'}
                size={15}
                color={i < livesDisplay ? '#D4A960' : '#4A4358'}
              />
            ))}
          </View>
        )}

        <View style={s.topCluster} pointerEvents="box-none">
          <Pressable
            style={s.topBtn}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Fermer le jeu"
          >
            <Ionicons name="close-outline" size={20} color="#988EA8" />
          </Pressable>
          <Pressable
            style={s.topBtn}
            onPress={toggleMute}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={muted ? 'Activer le son' : 'Couper le son'}
          >
            <Ionicons name={muted ? 'volume-mute-outline' : 'volume-high-outline'} size={20} color="#988EA8" />
          </Pressable>
          {uiState === 'playing' && (
            <Pressable
              style={s.topBtn}
              onPress={handlePause}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Mettre en pause"
            >
              <Ionicons name="pause-outline" size={20} color="#988EA8" />
            </Pressable>
          )}
        </View>

        {popups.map(p => (
          <FloatingPopup key={p.id} entry={p} onDone={handlePopupDone} reduceMotion={reduceMotion} />
        ))}

        {showStart && (
          countdown > 0 ? (
            <View style={s.startOverlay} pointerEvents="none">
              <Animated.View style={{ transform: [{ scale: countdownScale }] }}>
                <Text allowFontScaling={false} style={[s.goScore, { fontSize: 72 }]}>{countdown}</Text>
              </Animated.View>
            </View>
          ) : (
            <Pressable
              style={[s.startOverlay, { backgroundColor: 'rgba(11,7,18,0.55)' }]}
              onPress={startCountdown}
              accessibilityRole="button"
              accessibilityLabel={t('runner.startA11y')}
            >
              <Text style={s.title}>{t('runner.title')}</Text>
              <Text style={s.subtitle}>{t('runner.subtitle')}</Text>
              <View style={s.skinRow}>
                {SKINS.map(def => (
                  <SkinSwatch
                    key={def.key}
                    def={def}
                    unlocked={unlockedKeys.includes(def.key)}
                    selected={selectedKey === def.key}
                    onSelect={selectSkin}
                  />
                ))}
              </View>
              <Text style={s.tapLabel}>{t('runner.tapToPlay')}</Text>
              <Text style={s.hint} maxFontSizeMultiplier={1.3}>
                {t('runner.hint')}
              </Text>
              {dailyChallenge != null && (
                <View style={s.dailyCard}>
                  <Ionicons name={dailyDone ? 'checkmark-circle' : (dailyChallenge.icon as never)} size={20} color={dailyDone ? '#2DD4BF' : '#D4A960'} />
                  <View style={s.dailyCardText}>
                    <Text allowFontScaling={false} style={s.dailyOverline}>{t('runner.dailyOverline')}</Text>
                    <Text style={s.dailyLabel}>{dailyDone ? t('runner.dailyDoneLabel') : dailyChallenge.label}</Text>
                  </View>
                </View>
              )}
              {highScore > 0 && (
                <>
                  <Text style={s.startHiLabel}>{t('runner.record')}</Text>
                  <Text allowFontScaling={false} style={s.startHiScore}>{highScore}</Text>
                </>
              )}
            </Pressable>
          )
        )}

        {showGameOver && (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(300)} style={s.goOverlay}>
            <Text style={s.goTitle}>{t('runner.gameOverTitle')}</Text>
            <Text allowFontScaling={false} style={s.goScore}>{displayScore}</Text>
            {isRecord && (
              <View style={s.recordBadge}>
                <Text allowFontScaling={false} style={s.recordText}>{t('runner.newRecord')}</Text>
              </View>
            )}
            <Text style={s.goHiLabel}>{t('runner.recordLabel', { score: Math.max(highScore, displayScore) })}</Text>
            <View style={s.goStats}>
              <View style={s.goStat}>
                <Text allowFontScaling={false} style={s.goStatNum}>{finalStats.distance}</Text>
                <Text allowFontScaling={false} style={s.goStatLabel}>{t('runner.statMeters')}</Text>
              </View>
              <View style={s.goStat}>
                <Text allowFontScaling={false} style={s.goStatNum}>×{Math.max(1, finalStats.maxCombo)}</Text>
                <Text allowFontScaling={false} style={s.goStatLabel}>{t('runner.statComboMax')}</Text>
              </View>
              <View style={s.goStat}>
                <Text allowFontScaling={false} style={s.goStatNum}>{finalStats.nearMiss}</Text>
                <Text allowFontScaling={false} style={s.goStatLabel}>{t('runner.statNearmiss')}</Text>
              </View>
            </View>
            {newSkinLabels.map(label => (
              <View key={label} style={s.newSkinBadge}>
                <Ionicons name="color-palette-outline" size={14} color="#1F1A2E" />
                <Text allowFontScaling={false} style={s.newSkinText}>{t('runner.newSkinUnlocked', { label })}</Text>
              </View>
            ))}
            {freshTiers.map(f => (
              <View key={f.mission.key} style={s.missionBadge}>
                <Ionicons name={f.mission.icon as never} size={14} color="#D4A960" />
                <Text allowFontScaling={false} style={s.missionText}>{t('runner.missionTier', { label: f.mission.label, tier: f.tier })}</Text>
              </View>
            ))}
            {dailyJustDone && (
              <View style={s.dailyDoneBadge}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#1F1A2E" />
                <Text allowFontScaling={false} style={s.dailyDoneText}>{t('runner.dailyDoneBadge')}</Text>
              </View>
            )}
            {worldRank != null && (
              <Text allowFontScaling={false} style={s.rankText}>{t('runner.worldRank', { rank: worldRank })}</Text>
            )}
            {collectedText ? (
              <Text style={s.goPickups}>{collectedText}</Text>
            ) : null}
            {nextObj != null && (
              <View style={s.nextObjRow}>
                <Ionicons name={nextObj.icon as never} size={13} color="#988EA8" />
                <Text allowFontScaling={false} style={s.nextObjText}>
                  {t('runner.nextObjective', { label: nextObj.label, current: nextObj.current, target: nextObj.target, unit: nextObj.unit })}
                </Text>
              </View>
            )}
            {suggestedParfum != null && (
              <Pressable
                style={s.suggestedCard}
                onPress={handleOpenSuggested}
                accessibilityRole="button"
                accessibilityLabel={t('runner.suggestedA11y', { nom: suggestedParfum.nom, marque: suggestedParfum.marque })}
              >
                <Image source={{ uri: suggestedParfum.imageUrl }} style={s.suggestedImg} contentFit="contain" cachePolicy="memory-disk" recyclingKey={suggestedParfum.id} />
                <View style={s.suggestedText}>
                  <Text allowFontScaling={false} style={s.suggestedOverline}>{t('runner.suggestedOverline')}</Text>
                  <Text numberOfLines={1} style={s.suggestedName}>{suggestedParfum.nom}</Text>
                  <Text numberOfLines={1} style={s.suggestedBrand}>{t('runner.suggestedBrand', { marque: suggestedParfum.marque })}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#988EA8" />
              </Pressable>
            )}
            <Pressable style={s.retryBtn} onPress={handleRestart} accessibilityRole="button" accessibilityLabel={t('runner.retry')}>
              <Text style={s.retryText}>{t('runner.retry')}</Text>
            </Pressable>
            <Pressable style={s.shareBtn} onPress={handleShare} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('runner.shareScore')}>
              <Ionicons name="share-social-outline" size={16} color="#D4A960" />
              <Text style={s.shareText}>{t('runner.shareScore')}</Text>
            </Pressable>
            <Pressable style={s.quitBtn} onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('runner.quit')}>
              <Text style={s.quitText}>{t('runner.quit')}</Text>
            </Pressable>
          </Animated.View>
        )}

        {showPause && (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200)} style={s.goOverlay}>
            <Text style={s.goTitle}>{t('runner.pause')}</Text>
            <Pressable style={s.retryBtn} onPress={handleResume} accessibilityRole="button" accessibilityLabel={t('runner.resume')}>
              <Text style={s.retryText}>{t('runner.resume')}</Text>
            </Pressable>
            <Pressable style={s.quitBtn} onPress={handleRestart} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('runner.restart')}>
              <Text style={s.quitText}>{t('runner.restart')}</Text>
            </Pressable>
            <Pressable style={s.quitBtn} onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('runner.quit')}>
              <Text style={s.quitText}>{t('runner.quit')}</Text>
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
