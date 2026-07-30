// src/services/impl/catalog.supabase.ts — Implémentation Supabase de l'API
// catalogue (searchParfumsCached via RPC tsvector+trgm).
// Cf. MIGRATION_SUPABASE.md §5.

import type { Parfum } from '../../models';
import { normalize } from '../../utils/normalize';
import type { SeasonKey } from '../../utils/season';
import type { SuggestionRow } from '../../utils/suggest';
import { supabase } from '../supabase';
import type { Database } from '../../types/database.types';
import { LRUCache, dedupByMarqueNom, SearchError } from './search-shared';
import { toNum, toDate } from './sql-utils';

export { SearchError };

// ─── Mappers snake_case → Parfum ─────────────────────────────────────────────

function rowToParfum(row: Record<string, unknown>): Parfum {
  return {
    id: row.id as string,
    nom: row.nom as string,
    marque: row.marque as string,
    annee: toNum(row.annee) ?? undefined,
    familleOlactive: row.famille_olfactive as string,
    notesTete: (row.notes_tete as string[]) ?? [],
    notesCoeur: (row.notes_coeur as string[]) ?? [],
    notesFond: (row.notes_fond as string[]) ?? [],
    imageUrl: (row.image_url as string) ?? undefined,
    imageUrl2x: (row.image_url_2x as string) ?? undefined,
    bestPrice: toNum(row.best_price) ?? undefined,
    referencePrice: toNum(row.reference_price) ?? undefined,
    offers: (row.offers as Parfum['offers']) ?? [],
    typeParfum: (row.type_parfum as string | null) ?? undefined,
    source: row.source as Parfum['source'],
    cachedAt: toDate(row.cached_at),
    imageVerified: (row.image_verified as boolean) ?? undefined,
    searchText: (row.search_text as string) ?? undefined,
    purchaseUrl: (row.purchase_url as string | null) ?? undefined,
    mainAccords: (row.main_accords as string[]) ?? undefined,
    longevity: (row.longevity as string | null) ?? undefined,
    sillage: (row.sillage as string | null) ?? undefined,
    gender: (row.gender as string | null) ?? undefined,
    rating: (row.rating as string | null) ?? undefined,
    popularity: (row.popularity as string | null) ?? undefined,
    popularityScore: toNum(row.popularity_score) ?? undefined,
    ratingScore: toNum(row.rating_score) ?? undefined,
    reviewCount: toNum(row.review_count) ?? undefined,
    ratingCount: toNum(row.rating_count) ?? undefined,
    priceValue: (row.price_value as string | null) ?? undefined,
    country: (row.country as string) ?? undefined,
    mainAccordsPercentage: (row.main_accords_percentage as Record<string, string>) ?? undefined,
    generalNotes: (row.general_notes as string[]) ?? undefined,
    perfumers: (row.perfumers as string[]) ?? undefined,
    confidence: (row.confidence as string) ?? undefined,
    seasonRanking: (row.season_ranking as Parfum['seasonRanking']) ?? undefined,
    occasionRanking: (row.occasion_ranking as Parfum['occasionRanking']) ?? undefined,
    similarIds: (row.similar_ids as string[]) ?? undefined,
    similarIdsCachedAt: toDate(row.similar_ids_cached_at),
    createdAt: toDate(row.created_at) ?? new Date(),
    updatedAt: toDate(row.updated_at) ?? new Date(),
  };
}

// Mapping camelCase → snake_case pour les écritures (updateParfum)
const WRITE_MAP: Record<string, string> = {
  nom: 'nom', marque: 'marque', annee: 'annee',
  familleOlactive: 'famille_olfactive',
  notesTete: 'notes_tete', notesCoeur: 'notes_coeur', notesFond: 'notes_fond',
  imageUrl: 'image_url', imageUrl2x: 'image_url_2x',
  bestPrice: 'best_price', referencePrice: 'reference_price',
  offers: 'offers', source: 'source', cachedAt: 'cached_at',
  imageVerified: 'image_verified', typeParfum: 'type_parfum', purchaseUrl: 'purchase_url',
  mainAccords: 'main_accords', longevity: 'longevity', sillage: 'sillage',
  gender: 'gender', rating: 'rating', popularity: 'popularity',
  popularityScore: 'popularity_score', ratingScore: 'rating_score',
  reviewCount: 'review_count', ratingCount: 'rating_count',
  priceValue: 'price_value', country: 'country',
  mainAccordsPercentage: 'main_accords_percentage', generalNotes: 'general_notes',
  perfumers: 'perfumers', confidence: 'confidence',
  seasonRanking: 'season_ranking', occasionRanking: 'occasion_ranking',
  similarIds: 'similar_ids', similarIdsCachedAt: 'similar_ids_cached_at',
  createdAt: 'created_at', updatedAt: 'updated_at',
};

function parfumToRow(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const col = WRITE_MAP[k];
    if (!col || v === undefined) continue;
    out[col] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getParfumById(id: string): Promise<Parfum | undefined> {
  const { data, error } = await supabase
    .from('parfums')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return rowToParfum(data as Record<string, unknown>);
}

export async function updateParfum(id: string, fragranceData: Partial<Omit<Parfum, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const row = parfumToRow({ ...fragranceData, updatedAt: new Date() });
  // Changer l'image source invalide la version HD upscalée (dérivée de l'ancienne image).
  // Le batch `migrate-upscale` la régénérera au prochain run (image_url_2x IS NULL).
  if (fragranceData.imageUrl !== undefined) {
    row.image_url_2x = null;
  }
  const { error } = await supabase.from('parfums').update(row as Database['public']['Tables']['parfums']['Update']).eq('id', id);
  if (error) throw error;
}

// ─── Recherche (RPC search_parfums : tsvector + pg_trgm server-side) ─────────

const _searchCache = new LRUCache(200);

/** Vide le cache de recherche (après une mutation admin). */
export function clearSearchCache(): void {
  _searchCache.clear();
}

export async function searchParfumsCached(queryStr: string): Promise<Parfum[]> {
  const q = queryStr.trim().toLowerCase();
  if (q.length < 2) return [];

  const cached = _searchCache.get(q);
  if (cached !== undefined) return cached;

  const t0 = Date.now();

  try {
    const { data, error } = await supabase.rpc('search_parfums', { q, max_results: 50 });
    if (error) throw error;

    const rows = ((data ?? []) as Record<string, unknown>[]).map(rowToParfum);
    const deduped = dedupByMarqueNom(rows);
    if (__DEV__) console.log(`[search] "${q}" — RPC:${Date.now() - t0}ms (${deduped.length} results)`);
    _searchCache.set(q, deduped);
    return deduped;
  } catch (err: unknown) {
    throw new SearchError(
      (err as Error)?.message ?? 'La recherche a échoué. Vérifiez votre connexion.',
      err,
    );
  }
}

/** Entrée du rescoring scan — lecture GPT-4o (champs structurés + hypothèses). */
export interface ScanMatchInput {
  marque: string | null;
  nom: string | null;
  typeParfum?: string | null;
  volumeMl?: number | null;
  alternatives?: string[];
}

// Bonus/malus de rescoring scan (pondération nom > marque > concentration).
const SCORE_NOM_EXACT = 50;
const SCORE_NOM_PARTIEL = 25;
const SCORE_MARQUE_EXACT = 15;
const SCORE_MARQUE_PARTIEL = 8;
const SCORE_TYPE_MATCH = 12;
const SCORE_TYPE_MISMATCH = -12;

/** Recherche optimisée pour le scan — rescoring nom/marque/concentration sur la lecture GPT-4o. */
export async function searchParfumFromScan(read: ScanMatchInput): Promise<Parfum[]> {
  const { marque, nom, typeParfum, alternatives = [] } = read;

  // Requêtes : principale (marque + nom) + une par hypothèse alternative (meilleur rappel).
  const queries: string[] = [];
  const pushQuery = (n: string | null) => {
    const q = [marque, n].filter(Boolean).join(' ').trim();
    if (q.length >= 2 && !queries.includes(q)) queries.push(q);
  };
  pushQuery(nom);
  for (const alt of alternatives) pushQuery(alt);
  if (queries.length === 0) return [];

  // La requête principale propage les erreurs (le pipeline les gère) ; les alternatives sont best-effort.
  const merged = new Map<string, Parfum>();
  for (let i = 0; i < queries.length; i++) {
    try {
      const rows = await searchParfumsCached(queries[i]);
      for (const p of rows) if (!merged.has(p.id)) merged.set(p.id, p);
    } catch (e) {
      if (i === 0) throw e;
    }
  }
  if (merged.size === 0) return [];

  const normMarque = marque ? normalize(marque) : null;
  const candidateNoms = [nom, ...alternatives]
    .filter((n): n is string => !!n)
    .map(normalize);
  const normType = typeParfum ? normalize(typeParfum) : null;

  const rescored = [...merged.values()].map((p) => {
    const docMarque = normalize(p.marque || '');
    const docNom = normalize(p.nom || '');
    let bonus = 0;

    if (candidateNoms.length > 0) {
      if (candidateNoms.some((n) => docNom === n)) {
        bonus += SCORE_NOM_EXACT;
      } else if (candidateNoms.some((n) => docNom.includes(n) || n.includes(docNom))) {
        bonus += SCORE_NOM_PARTIEL;
      }
    }

    if (normMarque) {
      if (docMarque === normMarque) {
        bonus += SCORE_MARQUE_EXACT;
      } else if (docMarque.includes(normMarque) || normMarque.includes(docMarque)) {
        bonus += SCORE_MARQUE_PARTIEL;
      }
    }

    // Concentration (flankers EDT/EDP/Extrait…) : le type lu départage les homonymes.
    if (normType) {
      const docType = normalize(p.typeParfum ?? '');
      const inNom = docNom.includes(normType);
      if (docType === normType || inNom) {
        bonus += SCORE_TYPE_MATCH;
      } else if (docType) {
        bonus += SCORE_TYPE_MISMATCH;
      }
    }

    return { ...p, _scanScore: bonus };
  });

  rescored.sort((a, b) => {
    const diff = (b._scanScore ?? 0) - (a._scanScore ?? 0);
    if (diff !== 0) return diff;
    const aPrice = a.bestPrice ?? Infinity;
    const bPrice = b.bestPrice ?? Infinity;
    return aPrice - bPrice;
  });

  return dedupByMarqueNom(rescored);
}

/** Nombre total de parfums au catalogue (head query, pas de données transférées). */
export async function getParfumCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('parfums')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** Parfums les plus populaires. */
export async function getPopularParfums(limitCount: number = 6): Promise<Parfum[]> {
  try {
    const { data, error } = await supabase
      .from('parfums')
      .select('*')
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .limit(limitCount);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(rowToParfum);
  } catch {
    return [];
  }
}

/** Index léger pour les suggestions type-ahead (4 colonnes, tri popularité). */
export async function getSuggestionIndex(limitCount: number = 300): Promise<SuggestionRow[]> {
  try {
    const { data, error } = await supabase
      .from('parfums')
      .select('id, nom, marque, popularity_score')
      .not('image_url', 'is', null)
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .limit(limitCount);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(r => ({
      id: r.id as string,
      nom: r.nom as string,
      marque: r.marque as string,
      pop: (r.popularity_score as number) ?? 0,
    }));
  } catch {
    return [];
  }
}

/** Parfums les mieux notés (plancher de reviews pour la crédibilité). */
export async function getTopRatedParfums(limitCount: number = 12): Promise<Parfum[]> {
  try {
    const { data, error } = await supabase
      .from('parfums')
      .select('*')
      .not('rating_score', 'is', null)
      .gte('review_count', 50)
      .not('image_url', 'is', null)
      .order('rating_score', { ascending: false })
      .order('review_count', { ascending: false })
      .limit(limitCount);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(rowToParfum);
  } catch {
    return [];
  }
}

/** Parfums d'une famille olfactive (panier de valeurs famille_olfactive). */
export async function getParfumsByFamily(values: string[], limitCount: number = 50): Promise<Parfum[]> {
  if (values.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from('parfums')
      .select('*')
      .in('famille_olfactive', values)
      .not('image_url', 'is', null)
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .limit(limitCount);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(rowToParfum);
  } catch {
    return [];
  }
}

/** Aperçu des familles olfactives en 1 round-trip (RPC family_overviews).
 *  Renvoie, par clé de famille, les flacons les plus populaires (rotation
 *  côté client) + l'effectif total. Remplace N appels getFamilyOverview. */
export async function getFamilyOverviews(
  buckets: { key: string; values: string[] }[],
  topPerFamily: number = 5,
): Promise<Record<string, { bottles: string[]; count: number }>> {
  const empty: Record<string, { bottles: string[]; count: number }> = {};
  if (buckets.length === 0) return empty;
  for (const b of buckets) empty[b.key] = { bottles: [], count: 0 };
  try {
    const { data, error } = await supabase.rpc('family_overviews', {
      p_buckets: buckets,
      p_top: topPerFamily,
    });
    if (error) throw error;
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const key = row.bucket_key as string;
      const slot = empty[key];
      if (!slot) continue;
      const url = row.image_url as string | null;
      if (url) slot.bottles.push(url);
      slot.count = Number(row.total ?? 0);
    }
    return empty;
  } catch {
    return empty;
  }
}

/** Parfums dont la saison passée est la saison dominante (RPC argmax). */
export async function getSeasonalParfums(season: SeasonKey, limitCount: number = 12): Promise<Parfum[]> {
  try {
    const { data, error } = await supabase.rpc('seasonal_parfums', {
      season,
      lim: limitCount,
    });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(rowToParfum);
  } catch {
    return [];
  }
}

/** Suggestions personnalisées (RPC : scores famille/marque calculés en SQL). */
export async function getPersonalizedSuggestions(
  uid: string,
  limitCount: number = 16,
): Promise<Parfum[]> {
  // uid ignoré : l'RPC personalized_suggestions filtre via auth.uid()
  void uid;
  try {
    const { data, error } = await supabase.rpc('personalized_suggestions', { lim: limitCount });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(rowToParfum);
  } catch (e: unknown) {
    console.warn('[supabase] getPersonalizedSuggestions failed:', (e as Error)?.message ?? String(e));
    return [];
  }
}

/** Parfums similaires par accords partagés (RPC : intersection + shuffle SQL). */
export async function getSimilarParfums(mainAccords: string[], excludeId: string, limitCount: number = 6): Promise<Parfum[]> {
  if (!mainAccords || mainAccords.length === 0) return [];

  try {
    const { data, error } = await supabase.rpc('similar_parfums', {
      accords: mainAccords,
      exclude_id: excludeId,
      lim: limitCount,
    });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(rowToParfum);
  } catch {
    return [];
  }
}

export async function getParfumsByPerfumer(name: string): Promise<Parfum[]> {
  const { data, error } = await supabase
    .from('parfums')
    .select('*')
    .contains('perfumers', [name])
    .order('popularity_score', { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToParfum);
}

export async function getParfumsByMarque(marque: string): Promise<Parfum[]> {
  const { data, error } = await supabase
    .from('parfums')
    .select('*')
    .eq('marque', marque)
    .order('popularity_score', { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToParfum);
}
