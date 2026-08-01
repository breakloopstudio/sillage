// src/hooks/useWeather.ts — Météo actuelle via expo-location + Open-Meteo

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { fetchWeather, type WeatherData } from '../services/weather';

const POSITION_TIMEOUT_MS = 5000;
const INITIAL_DELAY_MS = 1000;
const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000;
const LAST_KNOWN_ACCURACY_M = 1000;

interface UseWeatherResult {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  coords: { lat: number; lon: number } | null;
  refresh: () => void;
}

export function useWeather(enabled = true): UseWeatherResult {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const mountedRef = useRef(true);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const fetchWithPosition = useCallback(async (force = false) => {
    let pos = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: LAST_KNOWN_ACCURACY_M,
    });
    let fromCache = pos !== null;
    if (!pos) {
      pos = await withTimeout(
        Location.getCurrentPositionAsync({}),
        POSITION_TIMEOUT_MS,
      );
      fromCache = false;
    }
    if (__DEV__ && pos) {
      const ageMs = pos.timestamp ? Date.now() - pos.timestamp : -1;
      console.log('[useWeather] position', {
        lat: Number(pos.coords.latitude.toFixed(4)),
        lon: Number(pos.coords.longitude.toFixed(4)),
        accuracy: pos.coords.accuracy,
        ageMs,
        fromCache,
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
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status === 'granted') {
        if (await fetchWithPosition(force)) return;
      } else if (status === 'undetermined') {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        if (newStatus === 'granted') {
          if (await fetchWithPosition(force)) return;
        }
      }

      if (mountedRef.current) {
        setError('Autorisez la localisation dans les paramètres système.');
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

  return { weather, loading, error, coords, refresh };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
