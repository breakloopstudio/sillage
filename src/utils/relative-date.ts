// src/utils/relative-date.ts — Formatage relatif court des dates (« il y a 3 j »).

import i18next from 'i18next';

export function formatRelativeShort(date: Date | null | undefined): string | null {
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return i18next.t('relative.justNow');
  if (min < 60) return i18next.t('relative.minutesAgo', { count: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return i18next.t('relative.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return i18next.t('relative.daysAgo', { count: days });
  return new Intl.DateTimeFormat(i18next.isInitialized ? i18next.language : 'fr', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
