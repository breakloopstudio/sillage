// scripts/import-supabase.ts — Phase 1 migration Supabase
// Import de data/migration/parfums.ndjson vers la table public.parfums.
//
//   npm run import-supabase                        # cible locale (Docker, via pg direct)
//   npm run import-supabase -- --target=cloud      # cible cloud (API + service_role du .env)
//
// Idempotent (ON CONFLICT / upsert sur id) — rejouable sans risque.

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import pg from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const INPUT_FILE = path.resolve('data', 'migration', 'parfums.ndjson');
const BATCH_SIZE = 1000;
const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

// Ordre exact des colonnes insérées (created_at/updated_at inclus depuis l'export)
const COLUMNS = [
  'id', 'nom', 'marque', 'annee', 'famille_olfactive',
  'notes_tete', 'notes_coeur', 'notes_fond',
  'image_url', 'best_price', 'reference_price', 'offers',
  'source', 'cached_at', 'image_verified', 'type_parfum', 'purchase_url',
  'main_accords', 'longevity', 'sillage', 'gender', 'rating', 'popularity',
  'popularity_score', 'rating_score', 'review_count', 'rating_count',
  'price_value', 'country', 'main_accords_percentage', 'general_notes',
  'perfumers', 'confidence', 'season_ranking', 'occasion_ranking',
  'similar_ids', 'similar_ids_cached_at', 'created_at', 'updated_at',
] as const;

// Colonnes jsonb : objets JS natifs côté API, stringifiées côté pg
const JSONB_COLS = new Set(['offers', 'main_accords_percentage', 'season_ranking', 'occasion_ranking']);

// ─── Coercions défensives (données scrapées, champs parfois hétérogènes) ────

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n === null ? null : Math.round(n);
}

function toBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function toStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function toSource(v: unknown): 'seed' | 'manual' {
  return v === 'manual' ? 'manual' : 'seed';
}

// Ligne NDJSON (camelCase Firestore) → objet snake_case aligné sur le schéma.
// DocumentData any-based — accès dynamique justifié (script de migration).
type RowObject = Record<string, unknown>;

function mapRowObject(obj: Record<string, unknown>): RowObject {
  return {
    id: toStr(obj.id),
    nom: toStr(obj.nom),
    marque: toStr(obj.marque),
    annee: toInt(obj.annee),
    famille_olfactive: toStr(obj.familleOlactive),
    notes_tete: toStrArr(obj.notesTete),
    notes_coeur: toStrArr(obj.notesCoeur),
    notes_fond: toStrArr(obj.notesFond),
    image_url: toStr(obj.imageUrl),
    best_price: toNum(obj.bestPrice),
    reference_price: toNum(obj.referencePrice),
    offers: obj.offers ?? [],                    // jsonb NOT NULL — absent de la plupart des docs
    source: toSource(obj.source),
    cached_at: toStr(obj.cachedAt),
    image_verified: toBool(obj.imageVerified),
    type_parfum: toStr(obj.typeParfum),
    purchase_url: toStr(obj.purchaseUrl),
    main_accords: toStrArr(obj.mainAccords),
    longevity: toStr(obj.longevity),
    sillage: toStr(obj.sillage),
    gender: toStr(obj.gender),
    rating: toStr(obj.rating),
    popularity: toStr(obj.popularity),
    popularity_score: toNum(obj.popularityScore),
    rating_score: toNum(obj.ratingScore),
    review_count: toInt(obj.reviewCount) ?? 0,   // NOT NULL
    rating_count: toInt(obj.ratingCount) ?? 0,   // NOT NULL
    price_value: toStr(obj.priceValue),
    country: toStr(obj.country),
    main_accords_percentage: obj.mainAccordsPercentage ?? null,
    general_notes: toStrArr(obj.generalNotes),
    perfumers: toStrArr(obj.perfumers),
    confidence: toStr(obj.confidence),
    season_ranking: obj.seasonRanking ?? null,
    occasion_ranking: obj.occasionRanking ?? null,
    similar_ids: toStrArr(obj.similarIds),
    similar_ids_cached_at: toStr(obj.similarIdsCachedAt),
    created_at: toStr(obj.createdAt) ?? new Date().toISOString(),
    updated_at: toStr(obj.updatedAt) ?? new Date().toISOString(),
  };
}

// ─── .env minimal (évite une dépendance dotenv) ─────────────────────────────

function readEnvVar(key: string): string | undefined {
  try {
    const content = fs.readFileSync(path.resolve('.env'), 'utf8');
    const m = content.match(new RegExp(`^${key}\\s*=\\s*(.+?)\\s*$`, 'm'));
    return m ? m[1] : undefined;
  } catch {
    return undefined;
  }
}

// ─── Interface d'import (2 implémentations) ──────────────────────────────────

interface ImportStats {
  written: number;
  errors: number;
}

interface Importer {
  readonly label: string;
  flush(rows: RowObject[], stats: ImportStats): Promise<void>;
  verify(read: number, stats: ImportStats, elapsedS: string): Promise<void>;
  close(): Promise<void>;
}

// ─── Mode local : pg direct (COPY-like, multi-row INSERT) ────────────────────

const UPDATE_SET = COLUMNS.filter((c) => c !== 'id')
  .map((c) => `${c} = excluded.${c}`)
  .join(', ');

class PgImporter implements Importer {
  readonly label: string;
  private client: pg.Client;

  private constructor(client: pg.Client, dbUrl: string) {
    this.client = client;
    this.label = `locale (pg) — ${dbUrl.replace(/:[^:@]+@/, ':***@')}`;
  }

  static async connect(dbUrl: string): Promise<PgImporter> {
    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();
    await client.query('set synchronous_commit = off'); // import rapide
    return new PgImporter(client, dbUrl);
  }

  async flush(rows: RowObject[], stats: ImportStats): Promise<void> {
    const params: unknown[] = [];
    const tuples = rows.map((rowObj) => {
      const placeholders = COLUMNS.map((col) => {
        const v = rowObj[col];
        params.push(JSONB_COLS.has(col) && v !== null && v !== undefined ? JSON.stringify(v) : v);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    const text = `insert into public.parfums (${COLUMNS.join(', ')}) values ${tuples.join(', ')} on conflict (id) do update set ${UPDATE_SET}`;
    try {
      await this.client.query(text, params as (string | number | boolean | string[] | null)[]);
      stats.written += rows.length;
    } catch (batchErr: unknown) {
      console.warn(`\n⚠️  Batch en échec (${(batchErr as Error)?.message}) — rejeu ligne par ligne…`);
      for (const rowObj of rows) {
        try {
          await this.flush([rowObj], { written: 0, errors: 0 });
          stats.written++;
        } catch (rowErr: unknown) {
          stats.errors++;
          console.warn(`  ❌ ligne ignorée (id=${rowObj.id}): ${(rowErr as Error)?.message}`);
        }
      }
    }
  }

  async verify(read: number, stats: ImportStats, elapsedS: string): Promise<void> {
    const countRes = await this.client.query('select count(*)::int as n from public.parfums');
    const dbCount = countRes.rows[0].n as number;
    printBilan(read, stats, elapsedS, dbCount);

    console.log(`\n——— Smoke test search_parfums ———`);
    for (const q of ['chanel', 'sauvage dior', 'chanell']) {
      const t = Date.now();
      const r = await this.client.query('select id, marque, nom from public.search_parfums($1) limit 5', [q]);
      console.log(`  "${q}" (${Date.now() - t}ms) → ${r.rows.map((x) => `${x.marque} ${x.nom}`).join(' | ') || '(aucun)'}`);
    }
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}

// ─── Mode cloud : API Supabase (service_role — bypass RLS) ──────────────────

class ApiImporter implements Importer {
  readonly label: string;
  private supabase: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.supabase = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.label = `CLOUD (API) — ${url}`;
  }

  async flush(rows: RowObject[], stats: ImportStats): Promise<void> {
    const { error } = await this.supabase.from('parfums').upsert(rows as never);
    if (!error) {
      stats.written += rows.length;
      return;
    }
    console.warn(`\n⚠️  Batch en échec (${error.message}) — rejeu ligne par ligne…`);
    for (const rowObj of rows) {
      const { error: rowError } = await this.supabase.from('parfums').upsert([rowObj] as never);
      if (rowError) {
        stats.errors++;
        console.warn(`  ❌ ligne ignorée (id=${rowObj.id}): ${rowError.message}`);
      } else {
        stats.written++;
      }
    }
  }

  async verify(read: number, stats: ImportStats, elapsedS: string): Promise<void> {
    const { count, error } = await this.supabase
      .from('parfums')
      .select('*', { count: 'exact', head: true });
    if (error) console.warn(`⚠️  count impossible: ${error.message}`);
    printBilan(read, stats, elapsedS, count ?? -1);

    console.log(`\n——— Smoke test search_parfums (via API) ———`);
    for (const q of ['chanel', 'sauvage dior', 'chanell']) {
      const t = Date.now();
      const { data, error: rpcError } = await this.supabase.rpc('search_parfums', { q, max_results: 5 } as never);
      if (rpcError) {
        console.log(`  "${q}" → ❌ ${rpcError.message}`);
      } else {
        const rows = (data ?? []) as { marque: string; nom: string }[];
        console.log(`  "${q}" (${Date.now() - t}ms) → ${rows.map((x) => `${x.marque} ${x.nom}`).join(' | ') || '(aucun)'}`);
      }
    }
  }

  async close(): Promise<void> {
    // rien à fermer côté API
  }
}

// ─── Bilan partagé ───────────────────────────────────────────────────────────

function printBilan(read: number, stats: ImportStats, elapsedS: string, dbCount: number): void {
  console.log(`\n——— Bilan ———`);
  console.log(`Lues (NDJSON)     : ${read}`);
  console.log(`Importées         : ${stats.written}`);
  console.log(`Erreurs           : ${stats.errors}`);
  console.log(`En base (count)   : ${dbCount}`);
  console.log(`Durée             : ${elapsedS}s`);
  if (dbCount >= 0 && dbCount < read - stats.errors) {
    console.warn(`⚠️  Écart détecté : ${read - stats.errors - dbCount} lignes manquantes.`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cloud = args.includes('--target=cloud') || args.includes('--cloud');

  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`${INPUT_FILE} introuvable — lancer d'abord npm run export-firestore`);
  }

  let importer: Importer;
  if (cloud) {
    const url = readEnvVar('EXPO_PUBLIC_SUPABASE_URL');
    const serviceKey = readEnvVar('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      throw new Error('Cible cloud : EXPO_PUBLIC_SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY manquants dans .env');
    }
    importer = new ApiImporter(url, serviceKey);
  } else {
    importer = await PgImporter.connect(LOCAL_DB_URL);
  }
  console.log(`Cible : ${importer.label}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT_FILE),
    crlfDelay: Infinity,
  });

  let read = 0;
  const stats: ImportStats = { written: 0, errors: 0 };
  let batch: RowObject[] = [];
  const t0 = Date.now();

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    await importer.flush(batch, stats);
    batch = [];
    if (stats.written % 5000 < BATCH_SIZE) {
      console.log(`  … ${stats.written} lignes importées (${read} lues, ${stats.errors} erreurs)`);
    }
  };

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    read++;
    try {
      batch.push(mapRowObject(JSON.parse(trimmed) as Record<string, unknown>));
    } catch (e: unknown) {
      stats.errors++;
      console.warn(`  ❌ JSON invalide ligne ${read}: ${(e as Error)?.message}`);
      continue;
    }
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  await importer.verify(read, stats, elapsed);
  await importer.close();
  console.log(`\n✅ Import terminé.`);
}

main().catch((e) => {
  console.error('❌ Import échoué :', (e as Error)?.message ?? e);
  process.exit(1);
});
