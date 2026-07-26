import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

const KEY = '@parfumscan/voice-search';

function readPref(): Promise<boolean> {
  return AsyncStorage.getItem(KEY).then(v => v !== 'false').catch(() => true);
}

export function useVoicePreference() {
  const [enabled, setEnabledState] = useState(true);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    readPref().then(v => { if (!cancelled) setEnabledState(v); });
    return () => { cancelled = true; };
  }, []));

  const setEnabled = useCallback((val: boolean) => {
    setEnabledState(val);
    AsyncStorage.setItem(KEY, String(val)).catch((e) => console.warn('[voice] persist failed:', e));
  }, []);

  return { voiceEnabled: enabled, setVoiceEnabled: setEnabled } as const;
}
