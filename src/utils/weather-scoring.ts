// src/utils/weather-scoring.ts — Score de compatibilité parfum × météo

import type { UserParfum } from '../models/user-parfum.interface';
import type { WeatherData } from '../services/weather';
import { getWmoMeta, mapTempToSeason } from './weather-codes';

const FAMILLE_SEASON: Record<string, Record<string, number>> = {
  citrus:      { spring: 0.9, summer: 1.2, fall: 0.7, winter: 0.4 },
  aromatic:    { spring: 1.0, summer: 1.1, fall: 0.8, winter: 0.5 },
  aquatic:     { spring: 0.9, summer: 1.3, fall: 0.6, winter: 0.3 },
  fresh:       { spring: 1.0, summer: 1.2, fall: 0.7, winter: 0.4 },
  fruity:      { spring: 1.0, summer: 1.1, fall: 0.8, winter: 0.5 },
  floral:      { spring: 1.2, summer: 0.8, fall: 0.9, winter: 0.5 },
  green:       { spring: 1.2, summer: 0.7, fall: 0.9, winter: 0.4 },
  oriental:    { spring: 0.6, summer: 0.4, fall: 1.1, winter: 1.3 },
  woody:       { spring: 0.6, summer: 0.5, fall: 1.2, winter: 1.1 },
  chypre:      { spring: 0.7, summer: 0.5, fall: 1.2, winter: 1.0 },
  leather:     { spring: 0.5, summer: 0.3, fall: 1.1, winter: 1.3 },
  amber:       { spring: 0.5, summer: 0.3, fall: 1.2, winter: 1.4 },
  spicy:       { spring: 0.5, summer: 0.3, fall: 1.2, winter: 1.3 },
};

const FAMILLE_FR_TO_EN: Record<string, string> = {
  'hespéridé': 'citrus', 'hespéride': 'citrus', 'citronné': 'citrus',
  'aromatique': 'aromatic',
  'aquatique': 'aquatic', 'marin': 'aquatic', 'marine': 'aquatic',
  'frais': 'fresh', 'fraîche': 'fresh',
  'fruité': 'fruity', 'fruitée': 'fruity',
  'fleuri': 'floral', 'fleurie': 'floral',
  'vert': 'green', 'verte': 'green', 'végétal': 'green',
  'oriental': 'oriental', 'orientale': 'oriental',
  'boisé': 'woody', 'boisée': 'woody',
  'chypré': 'chypre', 'chyprée': 'chypre',
  'cuir': 'leather',
  'ambré': 'amber', 'ambrée': 'amber',
  'épicé': 'spicy', 'épicée': 'spicy', 'épices': 'spicy',
};

const FAMILLE_DAY_NIGHT: Record<string, { day: number; night: number }> = {
  citrus:    { day: 1.0, night: 0.6 },
  aromatic:  { day: 0.9, night: 0.8 },
  aquatic:   { day: 1.0, night: 0.5 },
  fresh:     { day: 1.0, night: 0.6 },
  fruity:    { day: 1.0, night: 0.7 },
  floral:    { day: 1.0, night: 0.8 },
  green:     { day: 1.0, night: 0.7 },
  oriental:  { day: 0.6, night: 1.0 },
  woody:     { day: 0.7, night: 1.0 },
  chypre:    { day: 0.7, night: 1.0 },
  leather:   { day: 0.5, night: 1.0 },
  amber:     { day: 0.5, night: 1.0 },
  spicy:     { day: 0.5, night: 1.0 },
};

function normalizeFamille(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (FAMILLE_SEASON[lower]) return lower;
  const en = FAMILLE_FR_TO_EN[lower];
  if (en) return en;
  for (const key of Object.keys(FAMILLE_SEASON)) {
    if (lower.includes(key)) return key;
  }
  for (const [fr, enKey] of Object.entries(FAMILLE_FR_TO_EN)) {
    if (lower.includes(fr)) return enKey;
  }
  return null;
}

export function scoreWardrobeItemForWeather(item: UserParfum, weather: WeatherData): number {
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
  } else {
    score += 0.5;
  }

  if (item.isSignature) score += 0.1;
  if (item.sotdCount > 0) score += Math.min(item.sotdCount * 0.02, 0.15);

  return Math.min(Math.round(score * 100), 100);
}
