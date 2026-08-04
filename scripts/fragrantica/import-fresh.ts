/**
 * Import frais — data/clean/*.json → Supabase (Postgres + Storage)
 *
 * Pipeline complet pour un NOUVEAU scrape, sans passer par l'ancien backend
 * Firebase. Pour chaque parfum : parse le titre, transforme les champs,
 * télécharge l'image (URL Fragrantica), background removal optionnel,
 * conversion WebP, upload Storage, upsert Postgres. `image_url_2x` est laissé
 * NULL → `npm run migrate-upscale` génère la version HD au run suivant.
 *
 * Usage:
 *   npm run import-fresh                          # cible locale (Docker)
 *   npm run import-fresh -- --target=cloud        # cible cloud (.env)
 *   npm run import-fresh -- --bg                  # avec background removal (plus lent)
 *   npm run import-fresh -- --overwrite           # ré-importe même si l'id existe déjà
 *   npm run import-fresh -- --limit=50            # test sur 50 parfums
 *   npm run import-fresh -- --dry-run             # simulation sans écriture (ne touche pas au checkpoint)
 *   npm run import-fresh -- --refresh             # ignore le checkpoint (re-run forcé)
 *   npm run import-fresh -- --delay=300           # délai entre téléchargements (ms)
 *
 * Idempotent + resumable (checkpoint data/migration/import-fresh-progress.json).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { readEnvVar } from '../lib/script-utils';
import { parseTitle } from '../lib/title';
import { longevityString, sillageString, priceValueString } from '../lib/perf-strings';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CLEAN_DIR = path.resolve('data', 'clean');
const BUCKET = 'parfum-images';
const BG_REMOVAL_SCRIPT = path.resolve('scripts/images/bgremoval/remove-bg.cjs');
const BG_REMOVAL_CWD = path.resolve('scripts/images/bgremoval');
const PROGRESS_FILE = path.resolve('data/migration/import-fresh-progress.json');
const LOCAL_URL = 'http://127.0.0.1:54321';
const WEBP_QUALITY = 82;
const IMG_TIMEOUT_MS = 15_000;
const BG_TIMEOUT_MS = 60_000;
const PAGE_SIZE = 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CleanEntry {
  title: string;
  primaryImageUrl?: string;
  brandName: string;
  mainAccords?: { accord: string; value: number }[];
  pyramid?: {
    type: string;
    topNotes?: { name: string }[];
    middleNotes?: { name: string }[];
    baseNotes?: { name: string }[];
    allNotes?: { name: string }[];
  };
  longevityAverage?: number;
  sillageAverage?: number;
  longevityBreakout?: Record<string, number>[];
  sillageBreakout?: Record<string, number>[];
  priceValueAverage?: number;
  perfumeRating?: number;
  ratingCount?: number;
  reviewCount?: number;
  gender?: string;
  genderBreakout?: Record<string, number>;
  seasonBreakout?: Record<string, number>;
  perfumers?: string[];
  [key: string]: unknown;
}


interface Progress {
  done: string[];
  failed: { id: string; reason: string }[];
}

// ---------------------------------------------------------------------------
// Helpers: normalisation (parseTitle partagé dans ../lib/title.ts)
// ---------------------------------------------------------------------------

function normaliseTexte(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function normaliseId(s: string): string {
  return normaliseTexte(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}


// ---------------------------------------------------------------------------
// Helpers: conversion labels
// ---------------------------------------------------------------------------

function genderNormalise(g: string | undefined): string | null {
  if (!g) return null;
  const k = g.toLowerCase().trim();
  if (k.includes('unisex') || k.includes('women and men') || k.includes('men and women')) return 'unisex';
  if (k.includes('female') || k.includes('women')) return 'female';
  if (k.includes('male') || k.includes('men')) return 'male';
  return 'unisex';
}

// ---------------------------------------------------------------------------
// Image : download → bg removal optionnel → WebP
// ---------------------------------------------------------------------------

async function removeBackground(buffer: Buffer, id: string): Promise<Buffer | null> {
  const tmpIn = path.join(os.tmpdir(), `ifresh_${id}_in`);
  const tmpOut = path.join(os.tmpdir(), `ifresh_${id}_out.png`);
  try {
    fs.writeFileSync(tmpIn, buffer);
    await execFileAsync('node', [BG_REMOVAL_SCRIPT, tmpIn, tmpOut], {
      cwd: BG_REMOVAL_CWD,
      timeout: BG_TIMEOUT_MS,
      maxBuffer: 50 * 1024 * 1024,
    });
    if (fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 0) return fs.readFileSync(tmpOut);
    return null;
  } catch {
    return null;
  } finally {
    try { fs.unlinkSync(tmpIn); } catch { /* ignore */ }
    try { fs.unlinkSync(tmpOut); } catch { /* ignore */ }
  }
}

async function downloadAndProcess(
  sourceUrl: string,
  parfumId: string,
  bg: boolean,
): Promise<Buffer | null> {
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(IMG_TIMEOUT_MS) });
    if (!res.ok) return null;
    let buffer: Buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) return null;

    let hasAlpha = false;
    if (bg) {
      const removed = await removeBackground(buffer, parfumId);
      if (removed) {
        buffer = removed;
        hasAlpha = true;
      }
    }

    let pipe = sharp(buffer);
    if (!hasAlpha) pipe = pipe.flatten({ background: { r: 255, g: 255, b: 255 } });
    return await pipe.webp({ quality: WEBP_QUALITY }).toBuffer();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Transformation clean entry → ligne Postgres (snake_case)
// ---------------------------------------------------------------------------

function transformEntry(entry: CleanEntry, parfumId: string, imageUrl: string | null): Record<string, unknown> {
  const { nom, annee, typeParfum, genderLabel } = parseTitle(entry.title, entry.brandName);
  const pyramid = entry.pyramid;
  const full = pyramid?.type === 'full';

  const familleOlfactive = entry.mainAccords?.[0]?.accord ?? null;
  const mainAccords = entry.mainAccords?.map((a) => a.accord) ?? [];
  const mainAccordsPercentage: Record<string, string> = {};
  if (entry.mainAccords && entry.mainAccords.length > 0) {
    const maxVal = Math.max(...entry.mainAccords.map((a) => a.value), 1);
    for (const a of entry.mainAccords) {
      mainAccordsPercentage[a.accord] = `${Math.round((a.value / maxVal) * 100)}%`;
    }
  }

  let gender = genderNormalise(entry.gender) ?? genderNormalise(genderLabel);
  if (!gender && entry.genderBreakout) {
    const gb = entry.genderBreakout;
    const male = (gb.male ?? 0) + (gb.maleUnisex ?? 0);
    const female = (gb.female ?? 0) + (gb.femaleUnisex ?? 0);
    const uni = gb.unisex ?? 0;
    gender = male > female && male > uni ? 'male' : female > male && female > uni ? 'female' : 'unisex';
  }

  const seasonRanking = entry.seasonBreakout
    ? Object.entries(entry.seasonBreakout)
        .filter(([k]) => ['winter', 'spring', 'summer', 'autumn', 'day', 'night'].includes(k))
        .map(([name, score]) => ({ name, score }))
    : [];

  const now = new Date().toISOString();

  return {
    id: parfumId,
    nom,
    marque: entry.brandName,
    annee: annee ?? null,
    famille_olfactive: familleOlfactive,
    notes_tete: full ? (pyramid?.topNotes ?? []).map((n) => n.name) : [],
    notes_coeur: full ? (pyramid?.middleNotes ?? []).map((n) => n.name) : [],
    notes_fond: full ? (pyramid?.baseNotes ?? []).map((n) => n.name) : [],
    image_url: imageUrl,
    best_price: null,
    reference_price: null,
    offers: [],
    source: 'seed',
    cached_at: now,
    type_parfum: typeParfum ?? null,
    purchase_url: null,
    main_accords: mainAccords,
    longevity: longevityString(entry.longevityAverage),
    sillage: sillageString(entry.sillageAverage),
    longevity_breakout: entry.longevityBreakout ?? null,
    sillage_breakout: entry.sillageBreakout ?? null,
    gender: gender ?? null,
    rating: entry.perfumeRating != null ? String(entry.perfumeRating) : null,
    popularity_score: entry.reviewCount ?? 0,
    rating_score: entry.perfumeRating ?? null,
    review_count: entry.reviewCount ?? 0,
    rating_count: entry.ratingCount ?? 0,
    price_value: priceValueString(entry.priceValueAverage),
    main_accords_percentage: Object.keys(mainAccordsPercentage).length > 0 ? mainAccordsPercentage : null,
    general_notes: (pyramid?.allNotes ?? []).map((n) => n.name),
    perfumers: entry.perfumers ?? [],
    season_ranking: seasonRanking,
    occasion_ranking: null,
    similar_ids: [],
    similar_ids_cached_at: null,
    created_at: now,
    updated_at: now,
  };
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    const p = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) as Progress;
    console.log(`Reprise : ${p.done.length} déjà importés, ${p.failed.length} échecs.`);
    return p;
  }
  return { done: [], failed: [] };
}

function saveProgress(p: Progress): void {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p));
}

// ---------------------------------------------------------------------------
// IDs existants (pour skip sans --overwrite)
// ---------------------------------------------------------------------------

async function fetchExistingIds(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('parfums')
      .select('id')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`requete ids: ${error.message}`);
    const rows = data ?? [];
    for (const r of rows) ids.add(r.id as string);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cloud = args.includes('--target=cloud');
  const bg = args.includes('--bg');
  const overwrite = args.includes('--overwrite');
  const dryRun = args.includes('--dry-run');
  const refresh = args.includes('--refresh');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;
  const delayArg = args.find((a) => a.startsWith('--delay='));
  const delayMs = delayArg ? Number(delayArg.split('=')[1]) : 250;

  if (!fs.existsSync(CLEAN_DIR)) {
    console.error(`Dossier clean introuvable : ${CLEAN_DIR}`);
    console.error('Lancer d\'abord : npm run clean-data');
    process.exit(1);
  }
  if (bg && !fs.existsSync(BG_REMOVAL_SCRIPT)) {
    console.error(`--bg demandé mais ${BG_REMOVAL_SCRIPT} introuvable.`);
    process.exit(1);
  }

  const supaUrl = cloud ? readEnvVar('EXPO_PUBLIC_SUPABASE_URL') : LOCAL_URL;
  const supaKey = cloud
    ? readEnvVar('SUPABASE_SERVICE_ROLE_KEY')
    : readEnvVar('SUPABASE_LOCAL_SERVICE_ROLE');
  if (!supaUrl || !supaKey) {
    console.error(cloud
      ? 'EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env'
      : 'Mode local : SUPABASE_LOCAL_SERVICE_ROLE manquant dans .env (voir `supabase status`).');
    process.exit(1);
  }

  const supabase: SupabaseClient = createClient(supaUrl, supaKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Cible          : ${cloud ? 'CLOUD' : 'LOCALE'} (${supaUrl})`);
  console.log(`BG removal     : ${bg ? 'oui' : 'non'}`);
  console.log(`Overwrite      : ${overwrite ? 'oui' : 'non (skip existants)'}`);
  console.log(`Délai download : ${delayMs} ms`);
  if (dryRun) console.log('*** DRY RUN — aucune écriture ***');
  console.log('');

  // Indexer les entrées clean
  const files = fs.readdirSync(CLEAN_DIR).filter((f) => f.endsWith('.json'));
  const entries: { entry: CleanEntry; id: string }[] = [];
  for (const file of files) {
    let parsed: CleanEntry[];
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(CLEAN_DIR, file), 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    for (const entry of parsed) {
      if (!entry.title || !entry.brandName) continue;
      const { nom } = parseTitle(entry.title, entry.brandName);
      const id = normaliseId(`${entry.brandName}_${nom}`);
      if (id) entries.push({ entry, id });
    }
  }
  console.log(`${entries.length} entrées clean indexées (${files.length} fichiers).`);

  const progress = loadProgress();
  // --refresh ignore le checkpoint (reprise après un dry-run ou re-run forcé).
  const doneSet = refresh ? new Set<string>() : new Set(progress.done);
  const existingIds = overwrite ? new Set<string>() : await fetchExistingIds(supabase);
  console.log(`${existingIds.size} parfums déjà en base.\n`);

  let todo = entries.filter((e) => !doneSet.has(e.id) && (overwrite || !existingIds.has(e.id)));
  if (limit !== null) todo = todo.slice(0, limit);

  console.log(`${todo.length} à importer.\n`);
  if (todo.length === 0) {
    console.log('Rien à faire.');
    return;
  }

  const t0 = Date.now();
  let imported = 0;
  let noImage = 0;

  for (let i = 0; i < todo.length; i++) {
    const { entry, id } = todo[i];

    try {
      let imageUrl: string | null = null;
      if (entry.primaryImageUrl) {
        const webp = await downloadAndProcess(entry.primaryImageUrl, id, bg);
        if (webp) {
          if (!dryRun) {
            const destPath = `parfums/${id}/primary.webp`;
            const { error: upErr } = await supabase.storage
              .from(BUCKET)
              .upload(destPath, webp, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' });
            if (upErr) throw new Error(`upload: ${upErr.message}`);
            imageUrl = `${supaUrl}/storage/v1/object/public/${BUCKET}/${destPath}`;
          } else {
            imageUrl = `(dry) ${id}`;
          }
        } else {
          noImage++;
        }
      }

      const row = transformEntry(entry, id, imageUrl);
      if (!dryRun) {
        const { error: dbErr } = await supabase.from('parfums').upsert(row, { onConflict: 'id' });
        if (dbErr) throw new Error(`upsert: ${dbErr.message}`);
      }

      if (!dryRun) progress.done.push(id);
      imported++;
    } catch (e: unknown) {
      const reason = (e as Error)?.message?.slice(0, 120) ?? String(e);
      if (!dryRun) progress.failed.push({ id, reason });
    }

    if (delayMs > 0 && todo[i].entry.primaryImageUrl) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    if ((i + 1) % 20 === 0 || i + 1 === todo.length) {
      if (!dryRun) saveProgress(progress);
      const elapsed = Date.now() - t0;
      const rate = (i + 1) / (elapsed / 1000);
      const eta = (todo.length - i - 1) / Math.max(rate, 0.001);
      const pct = (((i + 1) / todo.length) * 100).toFixed(1);
      process.stdout.write(
        `\r[${pct.padStart(5)}%] ${i + 1}/${todo.length} | importés: ${imported} | ` +
        `sans image: ${noImage} | échecs: ${progress.failed.length} | ETA: ${Math.round(eta)}s   `,
      );
    }
  }

  if (!dryRun) saveProgress(progress);
  const totalTime = Date.now() - t0;
  console.log('\n');
  console.log('═'.repeat(58));
  console.log(`Import terminé en ${Math.round(totalTime / 1000)}s`);
  console.log(`  Importés   : ${imported}`);
  console.log(`  Sans image : ${noImage}`);
  console.log(`  Échecs     : ${progress.failed.length}`);
  console.log('═'.repeat(58));
  console.log('\nÉtape suivante : npm run migrate-upscale  (génère les images HD ×4)');
}

main().catch((e) => {
  console.error('Erreur fatale :', (e as Error)?.message ?? e);
  process.exit(1);
});
