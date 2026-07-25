// src/utils/favori-filters.ts — Types, prédicats et helpers pour les filtres favoris
// Pur (aucun import RN/Firebase) — importable par l'app, les scripts tsx et les tests

import { translateNote } from './translate-note';
import { SEASON_MATCH_THRESHOLD, SEASON_META, seasonScoresFromRanking, type SeasonKey } from './season';
import type { Parfum } from '../models';

export type LongevityBucket = 'weak' | 'moderate' | 'long' | 'eternal';
export type SillageBucket = 'intimate' | 'moderate' | 'strong' | 'enormous';
export type SillageFilterId = 'intimate' | 'moderate' | 'powerful';

export function longevityBucket(v: string | null | undefined): LongevityBucket | null {
  if (!v) return null;
  const k = v.toLowerCase().trim();
  if (k.includes('eternal') || k.includes('very long')) return 'eternal';
  if (k.includes('long')) return 'long';
  if (k.includes('moderate') || k.includes('modéré')) return 'moderate';
  if (k.includes('weak') || k.includes('court')) return 'weak';
  return null;
}

export function sillageBucket(v: string | null | undefined): SillageBucket | null {
  if (!v) return null;
  const k = v.toLowerCase().trim();
  if (k.includes('enormous')) return 'enormous';
  if (k.includes('strong') || k.includes('fort') || k.includes('heavy') || k.includes('lourd')) return 'strong';
  if (k.includes('moderate') || k.includes('modéré')) return 'moderate';
  if (k.includes('intimate') || k.includes('soft') || k.includes('léger') || k.includes('faible')) return 'intimate';
  return null;
}

export const LONGEVITY_OPTIONS: { bucket: LongevityBucket; label: string }[] = [
  { bucket: 'weak',     label: 'Courte' },
  { bucket: 'moderate', label: 'Modérée' },
  { bucket: 'long',     label: 'Longue' },
  { bucket: 'eternal',  label: 'Très longue' },
];

export const SILLAGE_OPTIONS: { id: SillageFilterId; label: string; buckets: SillageBucket[] }[] = [
  { id: 'intimate',  label: 'Intime',   buckets: ['intimate'] },
  { id: 'moderate',  label: 'Modéré',   buckets: ['moderate'] },
  { id: 'powerful',  label: 'Puissant', buckets: ['strong', 'enormous'] },
];

export interface FilterableItem {
  nom?: string | null;
  marque?: string | null;
  familleOlactive?: string | null;
  longevity?: string | null;
  sillage?: string | null;
  seasonScores?: { spring?: number; summer?: number; fall?: number; winter?: number } | null;
  notes?: string | string[] | null;
  allNotes?: string[] | null;
}

export interface FavoritesFilters {
  families: string[];
  seasons: SeasonKey[];
  longevity: LongevityBucket[];
  sillage: SillageFilterId[];
}

export const EMPTY_FAVORI_FILTERS: FavoritesFilters = {
  families: [],
  seasons: [],
  longevity: [],
  sillage: [],
};

export function countActiveFilters(f: FavoritesFilters): number {
  return f.families.length + f.seasons.length + f.longevity.length + f.sillage.length;
}

export function hasActiveFilters(f: FavoritesFilters): boolean {
  return countActiveFilters(f) > 0;
}

function sillageFilterIdForBucket(b: SillageBucket): SillageFilterId | null {
  const opt = SILLAGE_OPTIONS.find(o => o.buckets.includes(b));
  return opt?.id ?? null;
}

export function matchesFavoriFilters(fav: FilterableItem, f: FavoritesFilters): boolean {
  if (f.families.length > 0) {
    const fam = fav.familleOlactive ?? '';
    if (!f.families.includes(fam)) return false;
  }
  if (f.seasons.length > 0) {
    const scores = fav.seasonScores;
    if (!scores || !f.seasons.some(k => (scores[k] ?? 0) >= SEASON_MATCH_THRESHOLD)) return false;
  }
  if (f.longevity.length > 0) {
    const b = longevityBucket(fav.longevity);
    if (b === null || !f.longevity.includes(b)) return false;
  }
  if (f.sillage.length > 0) {
    const b = sillageBucket(fav.sillage);
    if (b === null) return false;
    const id = sillageFilterIdForBucket(b);
    if (id === null || !f.sillage.includes(id)) return false;
  }
  return true;
}

export function favoriMatchesSearch(fav: FilterableItem, q: string): boolean {
  const qq = q.toLowerCase().trim();
  if (!qq) return true;
  if ((fav.nom ?? '').toLowerCase().includes(qq)) return true;
  if ((fav.marque ?? '').toLowerCase().includes(qq)) return true;
  const favNotes = fav.notes;
  const notesArr: string[] = typeof favNotes === 'string' ? [favNotes] : favNotes ?? [];
  const allNotes = [...notesArr, ...(fav.allNotes ?? [])];
  return allNotes.some(n => n.toLowerCase().includes(qq) || translateNote(n).toLowerCase().includes(qq));
}

export function buildFavoriFilterFields(p: Parfum): {
  longevity: string | null;
  sillage: string | null;
  seasonScores: Partial<Record<SeasonKey, number>> | null;
  notes: string[] | null;
} {
  const allNotes = [
    ...(p.notesTete ?? []),
    ...(p.notesCoeur ?? []),
    ...(p.notesFond ?? []),
  ];
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const n of allNotes) {
    const trimmed = n.trim().toLowerCase();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    deduped.push(trimmed);
  }
  return {
    longevity: p.longevity ?? null,
    sillage: p.sillage ?? null,
    seasonScores: seasonScoresFromRanking(p.seasonRanking),
    notes: deduped.length > 0 ? deduped : null,
  };
}

export interface ActiveFilterChip {
  key: string;
  label: string;
  icon?: string;
  season?: SeasonKey;
}

export function buildActiveChips(f: FavoritesFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  for (const fam of f.families) chips.push({ key: `fam|${fam}`, label: translateNote(fam) });
  for (const k of f.seasons) chips.push({ key: `sea|${k}`, label: SEASON_META[k].label, icon: SEASON_META[k].icon, season: k });
  for (const b of f.longevity) chips.push({ key: `lon|${b}`, label: LONGEVITY_OPTIONS.find(o => o.bucket === b)?.label ?? b });
  for (const id of f.sillage) chips.push({ key: `sil|${id}`, label: SILLAGE_OPTIONS.find(o => o.id === id)?.label ?? id });
  return chips;
}

export function removeActiveChip(f: FavoritesFilters, chip: ActiveFilterChip): FavoritesFilters {
  const next = { ...f };
  if (chip.key.startsWith('fam|')) next.families = next.families.filter(x => `fam|${x}` !== chip.key);
  else if (chip.key.startsWith('sea|')) next.seasons = next.seasons.filter(k => `sea|${k}` !== chip.key);
  else if (chip.key.startsWith('lon|')) next.longevity = next.longevity.filter(b => `lon|${b}` !== chip.key);
  else if (chip.key.startsWith('sil|')) next.sillage = next.sillage.filter(id => `sil|${id}` !== chip.key);
  return next;
}
