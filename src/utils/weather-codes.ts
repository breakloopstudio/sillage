// src/utils/weather-codes.ts — Codes météo WMO : icônes, labels, boost saisonniers
// Labels résolus à l'affichage via getters i18next (§23) — clés sémantiques dédupliquées.

import i18next from 'i18next';

export interface WmoMeta {
  label: string;
  icon: string;
  seasonBoost: Record<string, number>;
}

export const WMO_META: Record<number, WmoMeta> = {
  0:  { get label() { return i18next.t('weather.label.sunny'); },        icon: 'sunny',             seasonBoost: { spring: 1.1, summer: 1.2, fall: 0.9, winter: 0.8 } },
  1:  { get label() { return i18next.t('weather.label.mainlyClear'); },  icon: 'partly-sunny',      seasonBoost: { spring: 1.0, summer: 1.1, fall: 1.0, winter: 1.0 } },
  2:  { get label() { return i18next.t('weather.label.partlyCloudy'); }, icon: 'cloudy',            seasonBoost: { spring: 0.9, summer: 0.8, fall: 1.1, winter: 1.0 } },
  3:  { get label() { return i18next.t('weather.label.overcast'); },     icon: 'cloudy',            seasonBoost: { spring: 0.8, summer: 0.7, fall: 1.2, winter: 1.1 } },
  45: { get label() { return i18next.t('weather.label.fog'); },          icon: 'cloudy',            seasonBoost: { spring: 0.7, summer: 0.6, fall: 1.3, winter: 1.2 } },
  48: { get label() { return i18next.t('weather.label.fog'); },          icon: 'cloudy',            seasonBoost: { spring: 0.7, summer: 0.6, fall: 1.3, winter: 1.2 } },
  51: { get label() { return i18next.t('weather.label.drizzle'); },      icon: 'rainy-outline',     seasonBoost: { spring: 0.8, summer: 0.7, fall: 1.0, winter: 0.9 } },
  53: { get label() { return i18next.t('weather.label.drizzle'); },      icon: 'rainy-outline',     seasonBoost: { spring: 0.8, summer: 0.7, fall: 1.0, winter: 0.9 } },
  55: { get label() { return i18next.t('weather.label.drizzle'); },      icon: 'rainy-outline',     seasonBoost: { spring: 0.7, summer: 0.6, fall: 1.0, winter: 0.8 } },
  56: { get label() { return i18next.t('weather.label.freezingDrizzle'); }, icon: 'snow',           seasonBoost: { spring: 0.2, summer: 0.0, fall: 0.5, winter: 1.2 } },
  57: { get label() { return i18next.t('weather.label.freezingDrizzle'); }, icon: 'snow',           seasonBoost: { spring: 0.1, summer: 0.0, fall: 0.4, winter: 1.2 } },
  61: { get label() { return i18next.t('weather.label.rain'); },         icon: 'rainy',             seasonBoost: { spring: 0.8, summer: 0.6, fall: 1.1, winter: 0.9 } },
  63: { get label() { return i18next.t('weather.label.rain'); },         icon: 'rainy',             seasonBoost: { spring: 0.7, summer: 0.5, fall: 1.0, winter: 0.8 } },
  65: { get label() { return i18next.t('weather.label.heavyRain'); },    icon: 'rainy',             seasonBoost: { spring: 0.6, summer: 0.4, fall: 0.9, winter: 0.7 } },
  66: { get label() { return i18next.t('weather.label.freezingDrizzle'); }, icon: 'snow',           seasonBoost: { spring: 0.2, summer: 0.0, fall: 0.5, winter: 1.2 } },
  67: { get label() { return i18next.t('weather.label.freezingDrizzle'); }, icon: 'snow',           seasonBoost: { spring: 0.1, summer: 0.0, fall: 0.4, winter: 1.2 } },
  71: { get label() { return i18next.t('weather.label.snow'); },         icon: 'snow',              seasonBoost: { spring: 0.3, summer: 0.0, fall: 0.7, winter: 1.5 } },
  73: { get label() { return i18next.t('weather.label.snow'); },         icon: 'snow',              seasonBoost: { spring: 0.2, summer: 0.0, fall: 0.6, winter: 1.5 } },
  75: { get label() { return i18next.t('weather.label.heavySnow'); },    icon: 'snow',              seasonBoost: { spring: 0.1, summer: 0.0, fall: 0.5, winter: 1.5 } },
  77: { get label() { return i18next.t('weather.label.snow'); },         icon: 'snow',              seasonBoost: { spring: 0.1, summer: 0.0, fall: 0.5, winter: 1.5 } },
  80: { get label() { return i18next.t('weather.label.showers'); },      icon: 'rainy-outline',     seasonBoost: { spring: 0.7, summer: 0.6, fall: 1.0, winter: 0.8 } },
  81: { get label() { return i18next.t('weather.label.showers'); },      icon: 'rainy-outline',     seasonBoost: { spring: 0.6, summer: 0.5, fall: 1.0, winter: 0.7 } },
  82: { get label() { return i18next.t('weather.label.showers'); },      icon: 'thunderstorm-outline', seasonBoost: { spring: 0.5, summer: 0.4, fall: 0.9, winter: 0.7 } },
  85: { get label() { return i18next.t('weather.label.snow'); },         icon: 'snow',              seasonBoost: { spring: 0.2, summer: 0.0, fall: 0.6, winter: 1.4 } },
  86: { get label() { return i18next.t('weather.label.snow'); },         icon: 'snow',              seasonBoost: { spring: 0.1, summer: 0.0, fall: 0.5, winter: 1.4 } },
  95: { get label() { return i18next.t('weather.label.thunderstorm'); }, icon: 'thunderstorm',      seasonBoost: { spring: 0.6, summer: 0.5, fall: 0.8, winter: 0.7 } },
  96: { get label() { return i18next.t('weather.label.thunderstorm'); }, icon: 'thunderstorm',      seasonBoost: { spring: 0.5, summer: 0.4, fall: 0.7, winter: 0.6 } },
  99: { get label() { return i18next.t('weather.label.thunderstorm'); }, icon: 'thunderstorm',      seasonBoost: { spring: 0.4, summer: 0.3, fall: 0.6, winter: 0.5 } },
};

export function getWmoMeta(code: number): WmoMeta {
  return WMO_META[code] ?? WMO_META[1];
}

export function mapTempToSeason(temp: number): 'spring' | 'summer' | 'fall' | 'winter' {
  if (temp > 28) return 'summer';
  if (temp >= 20) return 'spring';
  if (temp >= 10) return 'fall';
  return 'winter';
}
