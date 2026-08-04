// src/hooks/useWeather.ts — Météo actuelle via expo-location + Open-Meteo
// JAMAIS de prompt système automatique : load() ne fetch que si la permission
// est déjà accordée. La demande part d'un geste explicite (toggle Settings,
// tap météo de la SOTD card) via requestPermission(), après primer.

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { fetchWeather, type WeatherData } from '../services/weather';

const POSITION_TIMEOUT_MS = 10_000;
const INITIAL_DELAY_MS = 1000;
const LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;

interface UseWeatherResult {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  coords: { lat: number; lon: number } | null;
  refresh: () => void;
  /** Demande explicite la permission OS (après primer côté UI) puis fetch.
   *  Retourne true si la permission est accordée (déjà ou nouvellement). */
  requestPermission: () => Promise<boolean>;
  /** Statut courant de la permission OS (lecture silencieuse). */
  permissionStatus: Location.PermissionStatus | null;
  /** L'OS acceptera-t-il de re-prompter (false = refus définitif → réglages). */
  permissionCanAskAgain: boolean;
}

export function useWeather(enabled = true): UseWeatherResult {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [permissionCanAskAgain, setPermissionCanAskAgain] = useState(true);
  const mountedRef = useRef(true);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const fetchWithPosition = useCallback(async (force = false) => {
    let pos = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
    });
    let source: 'cache-fresh' | 'current' | 'cache-stale' = pos ? 'cache-fresh' : 'current';
    if (!pos) {
      pos = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        POSITION_TIMEOUT_MS,
      );
    }
    if (!pos) {
      pos = await Location.getLastKnownPositionAsync();
      source = 'cache-stale';
    }
    if (__DEV__ && pos) {
      const ageMs = pos.timestamp ? Date.now() - pos.timestamp : -1;
      console.log('[useWeather] position', {
        lat: Number(pos.coords.latitude.toFixed(4)),
        lon: Number(pos.coords.longitude.toFixed(4)),
        accuracy: pos.coords.accuracy,
        ageMs,
        source,
      });
    }
    if (pos) {
      const data = await fetchWeather(pos.coords.latitude, pos.coords.longitude, force);
      if (mountedRef.current) {
        if (data) {
          setWeather(data);
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        } else {
          setError('Impossible de récupérer la météo.');
        }
      }
      return true;
    }
    return false;
  }, []);

  const load = useCallback(async (force = false) => {
    if (!enabled) return;

    if (mountedRef.current) setLoading(true);
    if (mountedRef.current) setError(null);

    try {
      const perm = await Location.getForegroundPermissionsAsync();
      const { status } = perm;
      if (mountedRef.current) {
        setPermissionStatus(status);
        setPermissionCanAskAgain(perm.canAskAgain);
      }

      // Pas de prompt automatique : on ne fetch que si la permission est déjà
      // accordée. La demande explicite passe par requestPermission().
      if (status === 'granted') {
        if (await fetchWithPosition(force)) return;
        if (mountedRef.current) setError('Impossible de récupérer la météo.');
      }
    } catch (e: unknown) {
      if (mountedRef.current) {
        setError('Erreur lors de la récupération de la météo.');
      }
      console.warn('[useWeather]', (e as Error)?.message ?? String(e));
    } finally {
      hasLoadedRef.current = true;
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled, fetchWithPosition]);

  // Geste explicite (tap météo, toggle Settings) : pas de gate `enabled` ici —
  // le consentement app est posé par l'appelant au même moment. Le fetch passe
  // directement par fetchWithPosition (le `enabled` du hook peut être stale
  // dans le même tick, le temps que le réglage se propage).
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      const { status } = perm;
      if (mountedRef.current) {
        setPermissionStatus(status);
        setPermissionCanAskAgain(perm.canAskAgain);
      }

      const fetchNow = async () => {
        if (mountedRef.current) { setLoading(true); setError(null); }
        try {
          const ok = await fetchWithPosition(true);
          hasLoadedRef.current = true;
          if (!ok && mountedRef.current) setError('Impossible de récupérer la météo.');
        } finally {
          if (mountedRef.current) setLoading(false);
        }
      };

      if (status === 'granted') {
        await fetchNow();
        return true;
      }

      // Refus définitif (l'OS ne re-prompt plus) → orienter vers les réglages.
      if (status === 'denied' && !perm.canAskAgain) {
        if (mountedRef.current) setError('La localisation est désactivée. Active-la dans les réglages de l\'appareil.');
        return false;
      }

      const req = await Location.requestForegroundPermissionsAsync();
      if (mountedRef.current) setPermissionStatus(req.status);
      if (req.status === 'granted') {
        await fetchNow();
        return true;
      }

      if (mountedRef.current) setError(!req.canAskAgain
        ? 'La localisation est désactivée. Active-la dans les réglages de l\'appareil.'
        : 'Sans localisation, la météo reste indisponible.');
      return false;
    } catch (e: unknown) {
      console.warn('[useWeather] requestPermission failed:', (e as Error)?.message ?? String(e));
      if (mountedRef.current) setError('Erreur lors de la récupération de la météo.');
      return false;
    }
  }, [fetchWithPosition]);

  // Consentement retiré : on efface l'état (plus de météo affichée, plus de
  // coords à persister) — le retrait doit être immédiat et visible.
  useEffect(() => {
    if (!enabled) {
      setWeather(null);
      setCoords(null);
      setError(null);
      hasLoadedRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(load, INITIAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [load, enabled]);

  useFocusEffect(
    useCallback(() => {
      if (enabled && hasLoadedRef.current) {
        load(true);
      }
    }, [enabled, load]),
  );

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  return { weather, loading, error, coords, refresh, requestPermission, permissionStatus, permissionCanAskAgain };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
