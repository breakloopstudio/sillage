// src/services/impl/catalog.supabase.ts — Implémentation Supabase de l'API
// catalogue (searchParfumsCached via RPC tsvector+trgm).
// Cf. MIGRATION_SUPABASE.md §5.

import type { Parfum } from '../../models';
import i18next from 'i18next';
import { normalize } from '../../utils/normalize';
import type { SeasonKey } from '../../utils/season';
import type { SuggestionRow } from '../../utils/suggest';
import { typeParfumLabel } from '../../utils/parfum-labels';
import {
  brandQueryForms, brandsRelated, canonicalBrand, fuzzyNameBonus,
  SCORE_NOM_EXACT, SCORE_NOM_PARTIEL,
  SCORE_MARQUE_EXACT, SCORE_MARQUE_PARTIEL, SCORE_TYPE_MATCH, SCORE_TYPE_MISMATCH,
} from '../../utils/scan-match';
import { supabase } from '../supabase';
import type { Database } from '../../types/database.types';
import { LRUCache, dedupByMarqueNom, SearchError } from './search-shared';
import { clearHomeCache } from './home-cache';
import { toNum, toDate } from './sql-utils';
import { getColorByKey } from '../../utils/chromatic-wheel';

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
    searchText: (row.search_text as string) ?? undefined,
    purchaseUrl: (row.purchase_url as string | null) ?? undefined,
    mainAccords: (row.main_accords as string[]) ?? undefined,
    longevity: (row.longevity as string | null) ?? undefined,
    sillage: (row.sillage as string | null) ?? undefined,
    gender: (row.gender as string | null) ?? undefined,
    rating: (row.rating as string | null) ?? undefined,
    popularityScore: toNum(row.popularity_score) ?? undefined,
    ratingScore: toNum(row.rating_score) ?? undefined,
    reviewCount: toNum(row.review_count) ?? undefined,
    ratingCount: toNum(row.rating_count) ?? undefined,
    priceValue: (row.price_value as string | null) ?? undefined,
    mainAccordsPercentage: (row.main_accords_percentage as Record<string, string>) ?? undefined,
    generalNotes: (row.general_notes as string[]) ?? undefined,
    perfumers: (row.perfumers as string[]) ?? undefined,
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
  typeParfum: 'type_parfum', purchaseUrl: 'purchase_url',
  mainAccords: 'main_accords', longevity: 'longevity', sillage: 'sillage',
  gender: 'gender', rating: 'rating',
  popularityScore: 'popularity_score', ratingScore: 'rating_score',
  reviewCount: 'review_count', ratingCount: 'rating_count',
  priceValue: 'price_value',
  mainAccordsPercentage: 'main_accords_percentage', generalNotes: 'general_notes',
  perfumers: 'perfumers',
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

// Projection allégée pour les listes (cartes) — miroir de la vue SQL parfum_card
// (migrations 0054/0057). Exclut search_vector / search_text (tsvector, jamais lus) et
// les champs fiche-détail (offers, occasion_ranking, main_accords_percentage,
// general_notes, similar_ids, purchase_url). rating est inclus (fallback du chip ★,
// communityRatingLabel). season_ranking est CONSERVÉ (dénormalisation filtres favoris —
// buildFavoriFilterFields). La fiche détail reste en select('*') (getParfumById / getParfumsByIds).
const CARD_COLUMNS =
  'id, nom, marque, annee, famille_olfactive, ' +
  'notes_tete, notes_coeur, notes_fond, ' +
  'image_url, image_url_2x, ' +
  'best_price, reference_price, price_value, ' +
  'type_parfum, gender, ' +
  'main_accords, longevity, sillage, ' +
  'rating, popularity_score, rating_score, review_count, rating_count, ' +
  'perfumers, season_ranking, ' +
  'source, cached_at, ' +
  'created_at, updated_at';

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

/** Lecture batchée par ids (PK) — fallback d'affichage pour les alertes orphelines
 *  (parfum ni en favoris ni en parfumerie). Lecture publique, pas de migration. */
export async function getParfumsByIds(ids: string[]): Promise<Parfum[]> {
  if (ids.length === 0) return [];
  try {
    const { data, error } = await supabase.from('parfums').select('*').in('id', ids);
    if (error) throw error;
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(rowToParfum);
  } catch (e: unknown) {
    console.warn('[catalog] getParfumsByIds failed:', (e as Error)?.message ?? String(e));
    return [];
  }
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

// Roue chromatique : 12 clés max — cache mémoire + dédup in-flight (partagé
// entre /wheel et /search?color= : la sélection posée préchauffe la liste,
// l'écran de résultats lit la même entrée sans second fetch). Pas de disque :
// contenu rarement consommé au boot.
const CHROMA_TTL_MS = 30 * 60 * 1000;
const _chromaCache = new Map<string, { results: Parfum[]; cachedAt: number }>();
const _chromaInflight = new Map<string, Promise<Parfum[]>>();

/** Vide le cache de recherche (après une mutation admin). */
export function clearSearchCache(): void {
  _searchCache.clear();
  _chromaCache.clear();
  void clearHomeCache();
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

    const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map(rowToParfum);
    const deduped = dedupByMarqueNom(rows);
    if (__DEV__) console.log(`[search] "${q}" — RPC:${Date.now() - t0}ms (${deduped.length} results)`);
    _searchCache.set(q, deduped);
    return deduped;
  } catch (err: unknown) {
    throw new SearchError(
      (err as Error)?.message ?? i18next.t('search.searchFailedConn'),
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

/** Rescoring scan d'une liste de candidats — nom (exact > inclusion > fuzzy),
 *  marque (canonicalisée via alias), concentration (valeurs canoniques des deux côtés). */

// Phrases canoniques de concentration, de la plus longue à la plus courte :
// « eau_de_parfum » contient « parfum » — la plus longue trouvée dans un nom
// gagne, sinon « Eau de Parfum » confirmerait à tort la concentration « Parfum ».
const TYPE_PHRASES_DESC = ['eau_de_toilette', 'eau_de_cologne', 'eau_de_parfum', 'extrait', 'cologne', 'parfum'];

function typeFromNom(nomNorm: string): string | null {
  for (const t of TYPE_PHRASES_DESC) {
    if (nomNorm.includes(t)) {
      // « cologne » seul dans un nom confirme la concentration « Eau de Cologne »
      // (readType est canonicalisé par typeParfumLabel : jamais 'cologne').
      return t === 'cologne' ? 'eau_de_cologne' : t;
    }
  }
  return null;
}

function rescoreForScan(rows: Parfum[], read: ScanMatchInput): Array<Parfum & { _scanScore: number }> {
  const { marque, nom, typeParfum, alternatives = [] } = read;
  const readBrand = marque ? canonicalBrand(marque) : null;
  const candidateNoms = [nom, ...alternatives].filter((n): n is string => !!n);
  const readType = typeParfum ? normalize(typeParfumLabel(typeParfum) ?? '') : null;
  // Concentration prononcée : la demande complète est « nom + concentration »
  // (« L'Homme Idéal Parfum ») — ajoutée comme candidat pour que le flanker
  // concentré matche en exact. Les extraits sont nommés « X Extrait de Parfum »
  // au catalogue (pas « X Extrait ») → candidat supplémentaire.
  if (readType && nom) {
    candidateNoms.push(`${nom} ${typeParfumLabel(typeParfum)}`);
    if (readType === 'extrait') candidateNoms.push(`${nom} Extrait de Parfum`);
  }

  return rows.map((p) => {
    let bonus = 0;

    const nomNorm = normalize(p.nom || '');
    const docType = readType ? normalize(typeParfumLabel(p.typeParfum) ?? '') : '';
    const typeConfirmed = !!readType && ((docType !== '' && docType === readType) || typeFromNom(nomNorm) === readType);

    // Nom : le meilleur candidat l'emporte (nom lu, alternative, nom+concentration).
    let nameBonus = 0;
    if (candidateNoms.length > 0) {
      nameBonus = Math.max(...candidateNoms.map((c) => fuzzyNameBonus(p.nom, c)));
    }
    // Concentration prononcée mais non confirmée par la fiche (type NULL ou
    // contradictoire) : le match « exact » du nom seul ne matche qu'à moitié la
    // demande — « L'Homme Idéal » (l'EDT) ne doit pas écraser « L'Homme Idéal
    // Parfum » quand l'utilisateur a dit « parfum ».
    if (readType && !typeConfirmed && nameBonus === SCORE_NOM_EXACT) {
      nameBonus = SCORE_NOM_PARTIEL;
    }
    bonus += nameBonus;

    // Marque : canonicalisation (alias YSL/MFK/JPG…) puis inclusion, puis
    // lignées (sous-ligne ↔ maison mère, ex. Casamorati 1888 ↔ Xerjoff).
    if (readBrand) {
      const docBrand = canonicalBrand(p.marque || '');
      if (docBrand === readBrand) {
        bonus += SCORE_MARQUE_EXACT;
      } else if (docBrand.includes(readBrand) || readBrand.includes(docBrand) || brandsRelated(docBrand, readBrand)) {
        bonus += SCORE_MARQUE_PARTIEL;
      }
    }

    // Concentration (flankers EDT/EDP/Extrait…) : canonicalisée des deux côtés
    // (fin des −12 injustifiés sur « EDP » vs « Eau de Parfum »).
    if (readType) {
      if (typeConfirmed) {
        bonus += SCORE_TYPE_MATCH;
      } else if (docType) {
        bonus += SCORE_TYPE_MISMATCH;
      }
    }

    return { ...p, _scanScore: bonus };
  });
}

/** Tri scan : score desc, puis popularité desc, puis prix croissant. */
function sortByScanScore(rows: Array<Parfum & { _scanScore: number }>): Array<Parfum & { _scanScore: number }> {
  return [...rows].sort((a, b) => {
    const diff = b._scanScore - a._scanScore;
    if (diff !== 0) return diff;
    const popDiff = (b.popularityScore ?? 0) - (a.popularityScore ?? 0);
    if (popDiff !== 0) return popDiff;
    return (a.bestPrice ?? Infinity) - (b.bestPrice ?? Infinity);
  });
}

/** Recherche optimisée pour le scan — rescoring nom/marque/concentration sur la lecture GPT-4o.
 *  Retourne des Parfum porteurs de `_scanScore` (bonus de pertinence scan). */
export async function searchParfumFromScan(read: ScanMatchInput): Promise<Array<Parfum & { _scanScore: number }>> {
  const { marque, nom, alternatives = [] } = read;
  const hasNom = !!nom || alternatives.length > 0;

  // Marque seule (aucun nom lu) : le top-50 trgm sur un nom de maison est peu
  // pertinent → catalogue complet de la maison (index b-tree marque), fallback trgm.
  // On interroge TOUTES les formes de surface de la maison (alias YSL/MFK/JPG…),
  // pas seulement la valeur lue — le catalogue stocke la forme longue.
  if (marque && !hasNom) {
    const forms = brandQueryForms(marque);
    let rows = await getParfumsByMarques(forms);
    if (rows.length === 0) {
      // Fallback trgm sur la forme la plus longue (meilleur rappel que l'abréviation).
      const longest = forms.reduce((a, b) => (b.length > a.length ? b : a), forms[0] ?? marque);
      rows = await searchParfumsCached(longest);
    }
    if (rows.length === 0) return [];
    return dedupByMarqueNom(sortByScanScore(rescoreForScan(rows, read)));
  }

  // Requêtes : principale (marque + nom) + une par hypothèse alternative (meilleur rappel).
  const queries: string[] = [];
  const pushQuery = (n: string | null) => {
    const q = [marque, n].filter(Boolean).join(' ').trim();
    if (q.length >= 2 && !queries.includes(q)) queries.push(q);
  };
  pushQuery(nom);
  for (const alt of alternatives) pushQuery(alt);
  if (queries.length === 0) return [];

  // Requêtes parallèles — la principale (index 0) propage ses erreurs (le pipeline
  // les gère) ; les alternatives sont best-effort.
  const settled = await Promise.allSettled(queries.map((q) => searchParfumsCached(q)));
  const merged = new Map<string, Parfum>();
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === 'fulfilled') {
      for (const p of s.value) if (!merged.has(p.id)) merged.set(p.id, p);
    } else if (i === 0) {
      throw s.reason;
    }
  }
  if (merged.size === 0) return [];

  return dedupByMarqueNom(sortByScanScore(rescoreForScan([...merged.values()], read)));
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
      .select(CARD_COLUMNS)
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .limit(limitCount);
    if (error) throw error;
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(rowToParfum);
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
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(r => ({
      id: r.id as string,
      nom: r.nom as string,
      marque: r.marque as string,
      pop: toNum(r.popularity_score) ?? 0,
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
      .select(CARD_COLUMNS)
      .not('rating_score', 'is', null)
      .gte('review_count', 50)
      .not('image_url', 'is', null)
      .order('rating_score', { ascending: false })
      .order('review_count', { ascending: false })
      .limit(limitCount);
    if (error) throw error;
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(rowToParfum);
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
      .select(CARD_COLUMNS)
      .in('famille_olfactive', values)
      .not('image_url', 'is', null)
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .limit(limitCount);
    if (error) throw error;
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(rowToParfum);
  } catch {
    return [];
  }
}

/** Parfums d'une couleur de la roue chromatique (RPC chroma_parfums 0061).
 *  Scoring serveur : intensité des accords (main_accords_percentage) + match
 *  des notes (search_vector) + popularité, boost saisonnier si affinité.
 *  Cache mémoire partagé wheel→search (12 clés, TTL 30 min, dédup in-flight). */
export async function getParfumsByColor(colorKey: string, limitCount: number = 50): Promise<Parfum[]> {
  const def = getColorByKey(colorKey);
  if (!def) return [];

  // Clé = couleur + limit (le résultat dépend des deux).
  const cacheKey = `${def.key}:${limitCount}`;

  const hit = _chromaCache.get(cacheKey);
  // Copie défensive : le même tableau est partagé wheel→search (posture LRUCache).
  if (hit && Date.now() - hit.cachedAt < CHROMA_TTL_MS) return [...hit.results];

  const pending = _chromaInflight.get(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const { data, error } = await supabase.rpc('chroma_parfums', {
        p_accords: def.accords,
        p_notes: def.notes,
        p_season: def.season ?? undefined,
        p_limit: limitCount,
      });
      if (error) throw error;
      const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map(rowToParfum);
      const deduped = dedupByMarqueNom(rows);
      _chromaCache.set(cacheKey, { results: deduped, cachedAt: Date.now() });
      return deduped;
    } catch (e: unknown) {
      console.warn('[catalog] getParfumsByColor failed:', (e as Error)?.message ?? String(e));
      return [] as Parfum[];
    } finally {
      _chromaInflight.delete(cacheKey);
    }
  })();
  _chromaInflight.set(cacheKey, promise);
  return promise;
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
      slot.count = toNum(row.total) ?? 0;
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
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(rowToParfum);
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
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(rowToParfum);
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
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(rowToParfum);
  } catch {
    return [];
  }
}

export async function getParfumsByPerfumer(name: string): Promise<Parfum[]> {
  try {
    const { data, error } = await supabase
      .from('parfums')
      .select(CARD_COLUMNS)
      .contains('perfumers', [name])
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .limit(50);
    if (error) throw error;
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(rowToParfum);
  } catch (e: unknown) {
    console.warn('[catalog] getParfumsByPerfumer failed:', (e as Error)?.message ?? String(e));
    return [];
  }
}

/** Catalogue d'une ou plusieurs formes de surface d'une maison (`.in` exact, tri popularité). */
export async function getParfumsByMarques(marques: string[]): Promise<Parfum[]> {
  const forms = [...new Set(marques.map((m) => m.trim()).filter(Boolean))];
  if (forms.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from('parfums')
      .select(CARD_COLUMNS)
      .in('marque', forms)
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .limit(1000);
    if (error) throw error;
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(rowToParfum);
  } catch (e: unknown) {
    console.warn('[catalog] getParfumsByMarques failed:', (e as Error)?.message ?? String(e));
    return [];
  }
}

export async function getParfumsByMarque(marque: string): Promise<Parfum[]> {
  return getParfumsByMarques([marque]);
}
