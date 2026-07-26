// supabase/functions/_shared/weather-scoring.ts — Scoring météo (port de functions/src/weather-scoring.ts pour Deno)

interface WmoMeta { label: string; icon: string; seasonBoost: Record<string, number>; }

const WMO_META: Record<number, WmoMeta> = {
  0:  { label: 'Ensoleillé',  icon: 'sunny',    seasonBoost: { spring: 1.1, summer: 1.2, fall: 0.9, winter: 0.8 } },
  1:  { label: 'Clair',       icon: 'partly-sunny', seasonBoost: { spring: 1.0, summer: 1.1, fall: 1.0, winter: 1.0 } },
  2:  { label: 'Nuageux',     icon: 'cloudy',   seasonBoost: { spring: 0.9, summer: 0.8, fall: 1.1, winter: 1.0 } },
  3:  { label: 'Couvert',     icon: 'cloudy',   seasonBoost: { spring: 0.8, summer: 0.7, fall: 1.2, winter: 1.1 } },
  45: { label: 'Brouillard',  icon: 'cloudy',   seasonBoost: { spring: 0.7, summer: 0.6, fall: 1.3, winter: 1.2 } },
  48: { label: 'Brouillard',  icon: 'cloudy',   seasonBoost: { spring: 0.7, summer: 0.6, fall: 1.3, winter: 1.2 } },
  51: { label: 'Bruine',      icon: 'rainy-outline', seasonBoost: { spring: 0.8, summer: 0.7, fall: 1.0, winter: 0.9 } },
  53: { label: 'Bruine',      icon: 'rainy-outline', seasonBoost: { spring: 0.8, summer: 0.7, fall: 1.0, winter: 0.9 } },
  55: { label: 'Bruine',      icon: 'rainy-outline', seasonBoost: { spring: 0.7, summer: 0.6, fall: 1.0, winter: 0.8 } },
  56: { label: 'Verglas',     icon: 'snow',     seasonBoost: { spring: 0.2, summer: 0.0, fall: 0.5, winter: 1.2 } },
  57: { label: 'Verglas',     icon: 'snow',     seasonBoost: { spring: 0.1, summer: 0.0, fall: 0.4, winter: 1.2 } },
  61: { label: 'Pluie',       icon: 'rainy',    seasonBoost: { spring: 0.8, summer: 0.6, fall: 1.1, winter: 0.9 } },
  63: { label: 'Pluie',       icon: 'rainy',    seasonBoost: { spring: 0.7, summer: 0.5, fall: 1.0, winter: 0.8 } },
  65: { label: 'Pluie forte', icon: 'rainy',    seasonBoost: { spring: 0.6, summer: 0.4, fall: 0.9, winter: 0.7 } },
  66: { label: 'Verglas',     icon: 'snow',     seasonBoost: { spring: 0.2, summer: 0.0, fall: 0.5, winter: 1.2 } },
  67: { label: 'Verglas',     icon: 'snow',     seasonBoost: { spring: 0.1, summer: 0.0, fall: 0.4, winter: 1.2 } },
  71: { label: 'Neige',       icon: 'snow',     seasonBoost: { spring: 0.3, summer: 0.0, fall: 0.7, winter: 1.5 } },
  73: { label: 'Neige',       icon: 'snow',     seasonBoost: { spring: 0.2, summer: 0.0, fall: 0.6, winter: 1.5 } },
  75: { label: 'Neige forte', icon: 'snow',     seasonBoost: { spring: 0.1, summer: 0.0, fall: 0.5, winter: 1.5 } },
  77: { label: 'Neige',       icon: 'snow',     seasonBoost: { spring: 0.1, summer: 0.0, fall: 0.5, winter: 1.5 } },
  80: { label: 'Averses',     icon: 'rainy-outline', seasonBoost: { spring: 0.7, summer: 0.6, fall: 1.0, winter: 0.8 } },
  81: { label: 'Averses',     icon: 'rainy-outline', seasonBoost: { spring: 0.6, summer: 0.5, fall: 1.0, winter: 0.7 } },
  82: { label: 'Averses',     icon: 'thunderstorm-outline', seasonBoost: { spring: 0.5, summer: 0.4, fall: 0.9, winter: 0.7 } },
  85: { label: 'Neige',       icon: 'snow',     seasonBoost: { spring: 0.2, summer: 0.0, fall: 0.6, winter: 1.4 } },
  86: { label: 'Neige',       icon: 'snow',     seasonBoost: { spring: 0.1, summer: 0.0, fall: 0.5, winter: 1.4 } },
  95: { label: 'Orage',       icon: 'thunderstorm', seasonBoost: { spring: 0.6, summer: 0.5, fall: 0.8, winter: 0.7 } },
  96: { label: 'Orage',       icon: 'thunderstorm', seasonBoost: { spring: 0.5, summer: 0.4, fall: 0.7, winter: 0.6 } },
  99: { label: 'Orage',       icon: 'thunderstorm', seasonBoost: { spring: 0.4, summer: 0.3, fall: 0.6, winter: 0.5 } },
};

const FAMILLE_SEASON: Record<string, Record<string, number>> = {
  citrus:   { spring: 0.9, summer: 1.2, fall: 0.7, winter: 0.4 },
  aromatic: { spring: 1.0, summer: 1.1, fall: 0.8, winter: 0.5 },
  aquatic:  { spring: 0.9, summer: 1.3, fall: 0.6, winter: 0.3 },
  fresh:    { spring: 1.0, summer: 1.2, fall: 0.7, winter: 0.4 },
  fruity:   { spring: 1.0, summer: 1.1, fall: 0.8, winter: 0.5 },
  floral:   { spring: 1.2, summer: 0.8, fall: 0.9, winter: 0.5 },
  green:    { spring: 1.2, summer: 0.7, fall: 0.9, winter: 0.4 },
  oriental: { spring: 0.6, summer: 0.4, fall: 1.1, winter: 1.3 },
  woody:    { spring: 0.6, summer: 0.5, fall: 1.2, winter: 1.1 },
  chypre:   { spring: 0.7, summer: 0.5, fall: 1.2, winter: 1.0 },
  leather:  { spring: 0.5, summer: 0.3, fall: 1.1, winter: 1.3 },
  amber:    { spring: 0.5, summer: 0.3, fall: 1.2, winter: 1.4 },
  spicy:    { spring: 0.5, summer: 0.3, fall: 1.2, winter: 1.3 },
};

const FAMILLE_DAY_NIGHT: Record<string, { day: number; night: number }> = {
  citrus: { day: 1.0, night: 0.6 }, aromatic: { day: 0.9, night: 0.8 },
  aquatic: { day: 1.0, night: 0.5 }, fresh: { day: 1.0, night: 0.6 },
  fruity: { day: 1.0, night: 0.7 }, floral: { day: 1.0, night: 0.8 },
  green: { day: 1.0, night: 0.7 }, oriental: { day: 0.6, night: 1.0 },
  woody: { day: 0.7, night: 1.0 }, chypre: { day: 0.7, night: 1.0 },
  leather: { day: 0.5, night: 1.0 }, amber: { day: 0.5, night: 1.0 },
  spicy: { day: 0.5, night: 1.0 },
};

export function getWmoMeta(code: number): WmoMeta { return WMO_META[code] ?? WMO_META[1]; }

function mapTempToSeason(temp: number): 'spring' | 'summer' | 'fall' | 'winter' {
  if (temp > 28) return 'summer'; if (temp >= 20) return 'spring';
  if (temp >= 10) return 'fall'; return 'winter';
}

function normalizeFamille(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  for (const key of Object.keys(FAMILLE_SEASON)) { if (lower.includes(key)) return key; }
  return null;
}

export interface WeatherData { temperature: number; weatherCode: number; isDay: boolean; dailyMax: number; }
export interface WardrobeEntry { parfumId: string; nom: string|null; marque: string|null; familleOlactive: string|null; ownership: string; isSignature?: boolean; sotdCount?: number; }

export async function fetchWeatherForServer(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max&timezone=auto&forecast_days=1`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      temperature: data.current.temperature_2m,
      weatherCode: data.current.weather_code,
      isDay: data.current.is_day === 1,
      dailyMax: data.daily.temperature_2m_max[0] ?? data.current.temperature_2m,
    };
  } catch { return null; }
}

export function scoreItemForWeather(item: WardrobeEntry, weather: WeatherData): number {
  const famille = normalizeFamille(item.familleOlactive);
  const season = mapTempToSeason(weather.dailyMax ?? weather.temperature);
  const wmo = getWmoMeta(weather.weatherCode);
  let score = 0;
  if (famille) {
    const seasonAffinity = FAMILLE_SEASON[famille]?.[season] ?? 0.5;
    const wmoBoost = wmo.seasonBoost[season] ?? 1.0;
    score += seasonAffinity * wmoBoost * 0.5;
    const dayNight = FAMILLE_DAY_NIGHT[famille] ?? { day: 0.8, night: 0.8 };
    score += (weather.isDay ? dayNight.day : dayNight.night) * 0.25;
  } else { score += 0.5; }
  if (item.isSignature) score += 0.1;
  if (item.sotdCount && item.sotdCount > 0) score += Math.min(item.sotdCount * 0.02, 0.15);
  return Math.min(Math.round(score * 100), 100);
}

export function weatherEmoji(icon: string): string {
  switch (icon) {
    case 'sunny': return '☀️'; case 'partly-sunny': return '⛅';
    case 'cloudy': return '☁️'; case 'rainy': case 'rainy-outline': return '🌧️';
    case 'snow': return '❄️'; case 'thunderstorm': case 'thunderstorm-outline': return '⛈️';
    default: return '🌤️';
  }
}
