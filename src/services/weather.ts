// src/services/weather.ts — Météo Open-Meteo (gratuit, sans clé API)

const CACHE_DURATION_MS = 10 * 60 * 1000;

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  dailyMax: number;
  dailyMin: number;
  dailyWeatherCode: number;
  fetchedAt: number;
}

interface OpenMeteoCurrent {
  time: string;
  temperature_2m: number;
  weather_code: number;
  is_day: number;
}

interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weather_code: number[];
}

interface OpenMeteoResponse {
  current: OpenMeteoCurrent;
  daily: OpenMeteoDaily;
}

interface CacheEntry {
  data: WeatherData;
  lat: number;
  lon: number;
  key: string;
}

let cached: CacheEntry | null = null;
const pendingRequests = new Map<string, Promise<WeatherData | null>>();

function locationKey(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

export async function fetchWeather(lat: number, lon: number, force = false): Promise<WeatherData | null> {
  const now = Date.now();
  const key = locationKey(lat, lon);

  if (!force && cached && cached.key === key && (now - cached.data.fetchedAt) < CACHE_DURATION_MS) {
    return cached.data;
  }

  const pending = pendingRequests.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(lat));
      url.searchParams.set('longitude', String(lon));
      url.searchParams.set('current', 'temperature_2m,weather_code,is_day');
      url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code');
      url.searchParams.set('timezone', 'auto');
      url.searchParams.set('forecast_days', '1');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        console.warn('[weather] API error:', res.status);
        return null;
      }

      const data: OpenMeteoResponse = await res.json();
      const dailyMax = data.daily.temperature_2m_max[0] ?? data.current.temperature_2m;
      const dailyMin = data.daily.temperature_2m_min[0] ?? data.current.temperature_2m;
      const dailyCode = data.daily.weather_code[0] ?? data.current.weather_code;

      const result: WeatherData = {
        temperature: data.current.temperature_2m,
        weatherCode: data.current.weather_code,
        isDay: data.current.is_day === 1,
        dailyMax,
        dailyMin,
        dailyWeatherCode: dailyCode,
        fetchedAt: now,
      };

      cached = { data: result, lat, lon, key };
      return result;
    } catch (e: unknown) {
      console.warn('[weather] fetch failed:', (e as Error)?.message ?? String(e));
      return null;
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, promise);
  return promise;
}
