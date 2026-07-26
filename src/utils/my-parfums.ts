import type { UserFavori } from '../models';
import type { Parfum } from '../models';
import type { UserParfum, UserParfumStatus, ScentVerdict } from '../models/user-parfum.interface';
import { chipForStatus, type StatusChipId } from './status-chips';

export interface MyParfum {
  parfumId: string;
  nom: string | null;
  marque: string | null;
  imageUrl: string | null;
  familleOlactive: string | null;
  bestPrice?: number;
  referencePrice?: number;
  annee?: number;
  longevity: string | null;
  sillage: string | null;
  seasonScores: { spring?: number; summer?: number; fall?: number; winter?: number } | null;
  notes: string | null;
  allNotes: string[] | null;
  status: UserParfumStatus | null;
  verdict: ScentVerdict | null;
  rating: number | null;
  isFav: boolean;
  isSignature: boolean;
  shelfIds: string[];
  addedAt: Date;
}

export type PillId = 'all' | 'to_stat' | StatusChipId;

export const MY_PARFUM_PILLS: { id: PillId; label: string; icon: string }[] = [
  { id: 'all',     label: 'Tous',       icon: 'apps-outline' },
  { id: 'to_stat', label: 'À statuer',  icon: 'heart' },
  { id: 'to_try',  label: 'À sentir',   icon: 'eyedrop-outline' },
  { id: 'have',    label: 'Je l\u2019ai', icon: 'checkmark-circle-outline' },
  { id: 'had',     label: 'Je l\u2019ai eu', icon: 'flag-outline' },
];

function merge(parfumId: string, fav: UserFavori | undefined, up: UserParfum | undefined): MyParfum {
  return {
    parfumId,
    nom: up?.nom ?? fav?.nom ?? null,
    marque: up?.marque ?? fav?.marque ?? null,
    imageUrl: up?.imageUrl ?? fav?.imageUrl ?? null,
    familleOlactive: up?.familleOlactive ?? fav?.familleOlactive ?? null,
    bestPrice: up?.bestPrice ?? fav?.bestPrice,
    referencePrice: up?.referencePrice ?? fav?.referencePrice,
    annee: fav?.annee,
    longevity: up?.longevity ?? fav?.longevity ?? null,
    sillage: up?.sillage ?? fav?.sillage ?? null,
    seasonScores: up?.seasonScores ?? fav?.seasonScores ?? null,
    allNotes: up?.allNotes ?? fav?.notes ?? null,
    notes: up?.notes ?? null,
    status: up?.status ?? null,
    verdict: up?.verdict ?? null,
    rating: up?.rating ?? null,
    isFav: fav !== undefined,
    isSignature: up?.isSignature ?? false,
    shelfIds: up?.shelfIds ?? [],
    addedAt: up?.addedAt ?? fav?.addedAt ?? new Date(),
  };
}

export function buildMyParfums(favoris: UserFavori[], ups: UserParfum[]): MyParfum[] {
  const favById = new Map<string, UserFavori>();
  for (const f of favoris) favById.set(f.parfumId, f);

  const result = new Map<string, MyParfum>();
  for (const up of ups) {
    result.set(up.parfumId, merge(up.parfumId, favById.get(up.parfumId), up));
  }
  for (const fav of favoris) {
    if (!result.has(fav.parfumId)) result.set(fav.parfumId, merge(fav.parfumId, fav, undefined));
  }
  return [...result.values()];
}

export function pillOfItem(m: MyParfum): Exclude<PillId, 'all'> {
  if (m.status === null) return 'to_stat';
  return chipForStatus(m.status) ?? 'to_try';
}

export function filterByPill(items: MyParfum[], pill: PillId): MyParfum[] {
  if (pill === 'all') return items;
  return items.filter(m => pillOfItem(m) === pill);
}

export function myParfumToCard(m: MyParfum): Parfum {
  return {
    id: m.parfumId,
    nom: m.nom ?? '',
    marque: m.marque ?? '',
    imageUrl: m.imageUrl ?? undefined,
    familleOlactive: m.familleOlactive ?? '',
    bestPrice: m.bestPrice,
    referencePrice: m.referencePrice,
    annee: m.annee,
  } as Parfum;
}
