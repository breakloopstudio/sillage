import { createContext, useContext, useMemo } from 'react';
import {
  useSharedValue,
  useAnimatedReaction,
  useReducedMotion,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

export interface NavigationChromeContextValue {
  resetDock: () => void;
  dockTranslateY: SharedValue<number>;
  dockCompact: SharedValue<number>;
  scrollY: SharedValue<number>;
}

export const NavigationChromeContext = createContext<NavigationChromeContextValue | null>(null);

const COMPACT_THRESHOLD = 30;
const EXPAND_THRESHOLD = 8;
const HIDE_THRESHOLD = 320;
const REVEAL_THRESHOLD = 240;
const FAST_DELTA = 9;
const DOCK_HIDE = 120;
const DOCK_DURATION = 200;

const outCubic = Easing.out(Easing.cubic);

export function NavigationChromeProvider({ children }: { children: React.ReactNode }) {
  const scrollY = useSharedValue(0);
  const dockTranslateY = useSharedValue(0);
  const dockCompact = useSharedValue(0);
  const compactTarget = useSharedValue(0);
  const hideTarget = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useAnimatedReaction(
    () => scrollY.value,
    (current, prev) => {
      if (prev === null) return;
      const dur = reduceMotion ? 0 : DOCK_DURATION;
      const delta = current - (prev as number);
      const goingDown = delta > 0;

      let wantCompact: number;
      let wantHide: number;
      if (goingDown) {
        wantCompact = current > COMPACT_THRESHOLD ? 1 : compactTarget.value;
        wantHide = delta > FAST_DELTA || current > HIDE_THRESHOLD ? 1 : hideTarget.value;
      } else {
        wantHide = current > REVEAL_THRESHOLD ? hideTarget.value : 0;
        wantCompact = current < EXPAND_THRESHOLD ? 0 : 1;
      }

      if (wantCompact !== compactTarget.value) {
        compactTarget.value = wantCompact;
        dockCompact.value = withTiming(wantCompact, { duration: dur, easing: outCubic });
      }
      if (wantHide !== hideTarget.value) {
        hideTarget.value = wantHide;
        dockTranslateY.value = withTiming(wantHide ? DOCK_HIDE : 0, { duration: dur, easing: outCubic });
      }
    },
    [reduceMotion],
  );

  const value = useMemo<NavigationChromeContextValue>(() => ({
    resetDock: () => {
      const dur = reduceMotion ? 0 : DOCK_DURATION;
      scrollY.value = 0;
      compactTarget.value = 0;
      hideTarget.value = 0;
      dockCompact.value = withTiming(0, { duration: dur, easing: outCubic });
      dockTranslateY.value = withTiming(0, { duration: dur, easing: outCubic });
    },
    dockTranslateY,
    dockCompact,
    scrollY,
  }), [dockTranslateY, dockCompact, scrollY, compactTarget, hideTarget, reduceMotion]);

  return (
    <NavigationChromeContext.Provider value={value}>
      {children}
    </NavigationChromeContext.Provider>
  );
}

export function useNavigationChrome(): NavigationChromeContextValue {
  const ctx = useContext(NavigationChromeContext);
  if (!ctx) throw new Error('useNavigationChrome must be used within NavigationChromeProvider');
  return ctx;
}
