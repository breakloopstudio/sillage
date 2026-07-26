// src/services/impl/catalog.supabase.ts — Implémentation Supabase de l'API
// catalogue (searchParfumsCached via RPC tsvector+trgm, mêmes signatures que
// l'impl Firebase). Appelée par le dispatcher firestore.ts quand USE_SUPABASE=true.
// Cf. MIGRATION_SUPABASE.md §5.

import type { Parfum } from '../../models';
import { normalize, STOP_WORDS } from '../../utils/normalize';
import type { SeasonKey } from '../../utils/season';
import { supabase } from '../supabase';
import { LRUCache, dedupByMarqueNom, SearchError } from './search-shared';

export { SearchError };

// ─── Mappers snake_case → Parfum ─────────────────────────────────────────────

function toDate(v: unknown): Date | undefined {
  return typeof v === 'string' ? new Date(v) : undefined;
}

function rowToParfum(row: Record<string, unknown>): Parfum {
  return {
    id: row.id as string,
    nom: row.nom as string,
    marque: row.marque as string,
    annee: (row.annee as number) ?? undefined,
    familleOlactive: row.famille_olfactive as string,
    notesTete: (row.notes_tete as string[]) ?? [],
    notesCoeur: (row.notes_coeur as string[]) ?? [],
    notesFond: (row.notes_fond as string[]) ?? [],
    imageUrl: (row.image_url as string) ?? undefined,
    imageUrl2x: (row.image_url_2x as string) ?? undefined,
    bestPrice: (row.best_price as number) ?? undefined,
    referencePrice: (row.reference_price as number) ?? undefined,
    offers: (row.offers as Parfum['offers']) ?? [],
    typeParfum: (row.type_parfum as string | null) ?? undefined,
    source: row.source as Parfum['source'],
    cachedAt: toDate(row.cached_at),
    imageVerified: (row.image_verified as boolean) ?? undefined,
    // searchKeywords : absent du schéma (remplacé par la colonne générée search_text)
    searchText: (row.search_text as string) ?? undefined,
    purchaseUrl: (row.purchase_url as string | null) ?? undefined,
    mainAccords: (row.main_accords as string[]) ?? undefined,
    longevity: (row.longevity as string | null) ?? undefined,
    sillage: (row.sillage as string | null) ?? undefined,
    gender: (row.gender as string | null) ?? undefined,
    rating: (row.rating as string | null) ?? undefined,
    popularity: (row.popularity as string | null) ?? undefined,
    popularityScore: (row.popularity_score as number) ?? undefined,
    ratingScore: (row.rating_score as number) ?? undefined,
    reviewCount: (row.review_count as number) ?? undefined,
    ratingCount: (row.rating_count as number) ?? undefined,
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
  const { error } = await supabase.from('parfums').update(row as never).eq('id', id);
  if (error) throw error;
}

// ─── Recherche (RPC search_parfums : tsvector + pg_trgm server-side) ─────────

const _searchCache = new LRUCache(200);

/** Vérifie si une query est en cache sans appel réseau (rate limiter). */
export function peekSearchCache(queryStr: string): Parfum[] | undefined {
  return _searchCache.get(queryStr.trim().toLowerCase());
}

/** Vide le cache de recherche (après une mutation admin). */
export function clearSearchCache(): void {
  _searchCache.clear();
}

export async function searchParfumsCached(queryStr: string): Promise<Parfum[]> {
  const q = queryStr.trim().toLowerCase();
  if (q.length < 2) return [];

  const cached = _searchCache.get(q);
  if (cached !== undefined) return cached;

  const rawTokens = q.split(/\s+/).filter(t => t.length >= 2);
  if (rawTokens.length === 0) return [];

  const searchTokens = rawTokens
    .flatMap(t => normalize(t).split('_'))
    .filter(t => t.length >= 2 && !STOP_WORDS.has(t))
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);

  if (searchTokens.length === 0) {
    _searchCache.set(q, []);
    return [];
  }

  const multiToken = searchTokens.length >= 2;
  const normalizedQ = normalize(q);

  // Scoring local pour le prefix cache — sur search_text (équivalent des searchKeywords)
  const scoreDocs = (docs: Parfum[]): Parfum[] => {
    const scored = docs.map((p) => {
      const kw = (p.searchText ?? '').split(' ').filter(Boolean);
      let matchScore = 0;
      for (const token of searchTokens) {
        let best: string | undefined;
        for (const k of kw) {
          if (k.startsWith(token) && (!best || k.length < best.length)) best = k;
        }
        if (best) matchScore += token.length / best.length;
      }
      const exactMatch = multiToken && (p.searchText ?? '').replace(/ /g, '_') === normalizedQ ? 10 : 0;
      const pop = Math.max(p.reviewCount ?? 0, p.ratingCount ?? 0, p.popularityScore ?? 0);
      const popBonus = pop > 0 ? Math.log(pop + 1) / 2 : 0;
      return { p, _score: matchScore + exactMatch + popBonus, _pop: pop };
    });
    return scored
      .filter((d) => d._score > 0)
      .sort((a, b) => {
        const diff = b._score - a._score;
        if (Math.abs(diff) < 0.001) return b._pop - a._pop;
        return diff;
      })
      .slice(0, 50)
      .map((d) => d.p);
  };

  // Prefix cache : si une query plus courte est en cache, re-score localement
  // (même stratégie que l'impl Firebase : la query cachée la plus peuplée,
  // fallthrough réseau si < 5 résultats re-scorés)
  let bestKey = '';
  let bestResults: Parfum[] = [];
  for (const [key, results] of _searchCache.entries()) {
    if (results.length > 0 && q.startsWith(key) && q !== key && results.length > bestResults.length) {
      bestKey = key;
      bestResults = results;
    }
  }

  if (bestKey) {
    const reScored = scoreDocs(bestResults);
    let deduped: Parfum[];
    try { deduped = dedupByMarqueNom(reScored); } catch { deduped = reScored; }
    if (deduped.length >= 5) {
      _searchCache.set(q, deduped);
      if (__DEV__) console.log(`[search] "${q}" — prefix cache hit (from "${bestKey}", ${deduped.length} results)`);
      return deduped;
    }
    if (__DEV__) console.log(`[search] "${q}" — prefix cache low recall (${deduped.length}), falling through to RPC`);
  }

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

/** Recherche optimisée pour le scan — rescoring nom/marque structurés GPT-4o.
 *  Logique identique à l'impl Firebase (JS pur au-dessus de searchParfumsCached). */
export async function searchParfumFromScan(marque: string | null, nom: string | null): Promise<Parfum[]> {
  if (!marque && !nom) return [];

  const query = [marque, nom].filter(Boolean).join(' ').trim();
  if (query.length < 2) return [];

  const results = await searchParfumsCached(query);
  if (results.length === 0) return [];

  const normMarque = marque ? normalize(marque) : null;
  const normNom = nom ? normalize(nom) : null;

  const rescored = results.map((p) => {
    const docMarque = normalize(p.marque || '');
    const docNom = normalize(p.nom || '');
    let bonus = 0;

    if (normNom) {
      if (docNom === normNom) {
        bonus += 50;
      } else if (docNom.includes(normNom) || normNom.includes(docNom)) {
        bonus += 25;
      }
    }

    if (normMarque) {
      if (docMarque === normMarque) {
        bonus += 15;
      } else if (docMarque.includes(normMarque) || normMarque.includes(docMarque)) {
        bonus += 8;
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
