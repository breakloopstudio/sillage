import { createContext, useContext, useMemo } from 'react';
import { useSharedValue, useAnimatedReaction, withTiming, Easing, type SharedValue } from 'react-native-reanimated';

export interface NavigationChromeContextValue {
  resetDock: () => void;
  dockTranslateY: SharedValue<number>;
  scrollY: SharedValue<number>;
}

export const NavigationChromeContext = createContext<NavigationChromeContextValue | null>(null);

const SCROLL_HIDE_OFFSET = 60;
const DOCK_DURATION = 200;

export function NavigationChromeProvider({ children }: { children: React.ReactNode }) {
  const scrollY = useSharedValue(0);
  const dockTranslateY = useSharedValue(0);

  useAnimatedReaction(
    () => scrollY.value,
    (current, prev) => {
      if (prev === null) return;
      if (current > prev! && current > SCROLL_HIDE_OFFSET) {
        dockTranslateY.value = withTiming(120, { duration: DOCK_DURATION, easing: Easing.out(Easing.cubic) });
      } else if (current < prev!) {
        dockTranslateY.value = withTiming(0, { duration: DOCK_DURATION, easing: Easing.out(Easing.cubic) });
      }
    },
  );

  const value = useMemo<NavigationChromeContextValue>(() => ({
    resetDock: () => { scrollY.value = 0; },
    dockTranslateY,
    scrollY,
  }), [dockTranslateY, scrollY]);

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
