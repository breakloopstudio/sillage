/**
 * Backfill des distributions de votes Fragrantica (breakout) — alimente la
 * fusion avec les votes utilisateurs (0042_user_perf_votes.sql), SANS re-scraper.
 *
 * Remplit `parfums.longevity_breakout` / `sillage_breakout` (jsonb) depuis
 * data/clean (`longevityBreakout` / `sillageBreakout`) pour les ~25k parfums
 * existants, en matchant clean ↔ base par id BDD = normaliseId(marque_nom),
 * la même formule qu'import-fresh (parfumIdFromTitle).
 *
 * Les saisons n'ont pas besoin de backfill : leur breakout est déjà en base
 * via `season_ranking` (comptes de votes bruts).
 *
 * Usage :
 *   npm run backfill-breakouts                       DRY-RUN : rapport (défaut)
 *   npm run backfill-breakouts -- --write            applique en local (Docker)
 *   npm run backfill-breakouts -- --write --target=cloud
 *   npm run backfill-breakouts -- --limit=500
 *   npm run backfill-breakouts -- --sample=15
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readEnvVar, argValue, hasFlag } from '../lib/script-utils';
import { parfumIdFromTitle } from '../lib/title';

const CLEAN_DIR = path.resolve('data', 'clean');
const LOCAL_URL = 'http://127.0.0.1:54321';
const PAGE_SIZE = 1000;

interface CleanPerf {
  id: string;
  longevityBreakout: Record<string, number>[] | null;
  sillageBreakout: Record<string, number>[] | null;
}

function readClean(): Map<string, CleanPerf> {
  const map = new Map<string, CleanPerf>();
  const files = fs.readdirSync(CLEAN_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    let entries: {
      title?: string;
      brandName?: string;
      longevityBreakout?: Record<string, number>[];
      sillageBreakout?: Record<string, number>[];
    }[];
    try {
      entries = JSON.parse(fs.readFileSync(path.join(CLEAN_DIR, file), 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      if (!e.title || !e.brandName) continue;
      const id = parfumIdFromTitle(e.title, e.brandName);
      if (!id) continue;
      map.set(id, {
        id,
        longevityBreakout: Array.isArray(e.longevityBreakout) && e.longevityBreakout.length > 0 ? e.longevityBreakout : null,
        sillageBreakout: Array.isArray(e.sillageBreakout) && e.sillageBreakout.length > 0 ? e.sillageBreakout : null,
      });
    }
  }
  return map;
}

async function fetchExistingIds(supabase: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase.from('parfums').select('id').range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`lecture ids: ${error.message}`);
    const rows = data ?? [];
    for (const r of rows) ids.add(r.id as string);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return ids;
}

async function main(): Promise<void> {
  const write = hasFlag('write');
  const cloud = hasFlag('target=cloud');
  const limit = Number(argValue('limit') ?? '0') || 0;
  const sampleSize = Number(argValue('sample') ?? '15') || 15;

  if (!fs.existsSync(CLEAN_DIR)) {
    console.error(`Dossier clean introuvable : ${CLEAN_DIR} — lancer d'abord npm run clean-data`);
    process.exit(1);
  }

  const supaUrl = cloud ? readEnvVar('EXPO_PUBLIC_SUPABASE_URL') : LOCAL_URL;
  const supaKey = write
    ? (cloud ? readEnvVar('SUPABASE_SERVICE_ROLE_KEY') : readEnvVar('SUPABASE_LOCAL_SERVICE_ROLE'))
    : (cloud ? readEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY') : readEnvVar('SUPABASE_LOCAL_SERVICE_ROLE'));
  if (!supaUrl || !supaKey) {
    console.error(write
      ? 'Écriture : SUPABASE_SERVICE_ROLE_KEY (cloud) / SUPABASE_LOCAL_SERVICE_ROLE (local) manquant dans .env'
      : 'Lecture cloud : EXPO_PUBLIC_SUPABASE_ANON_KEY manquant dans .env');
    process.exit(1);
  }

  const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log(`Cible : ${cloud ? 'CLOUD' : 'LOCALE'} (${supaUrl})`);
  console.log(`Mode  : ${write ? 'ÉCRITURE' : 'DRY-RUN (rapport seul)'}\n`);

  console.log('Lecture de data/clean…');
  const clean = readClean();
  console.log(`  ${clean.size} parfums indexés depuis data/clean.`);

  console.log('Lecture des ids en base…');
  const existing = await fetchExistingIds(supabase);
  console.log(`  ${existing.size} parfums en base.\n`);

  let matched = 0;
  let cleanNotInBase = 0;
  let noLongevity = 0;
  let noSillage = 0;
  let neither = 0;
  const toWrite: { id: string; longevityBreakout: Record<string, number>[] | null; sillageBreakout: Record<string, number>[] | null }[] = [];

  for (const [id, row] of clean) {
    if (!existing.has(id)) { cleanNotInBase++; continue; }
    matched++;
    if (row.longevityBreakout === null && row.sillageBreakout === null) { neither++; continue; }
    if (row.longevityBreakout === null) noLongevity++;
    if (row.sillageBreakout === null) noSillage++;
    toWrite.push({ id, longevityBreakout: row.longevityBreakout, sillageBreakout: row.sillageBreakout });
  }

  console.log('═'.repeat(70));
  console.log(`Matchés clean↔base       : ${matched}`);
  console.log(`À backfiller (≥1 breakout): ${toWrite.length}`);
  console.log(`Sans breakout longévité   : ${noLongevity}`);
  console.log(`Sans breakout sillage     : ${noSillage}`);
  console.log(`Sans aucun breakout       : ${neither}`);
  console.log(`Clean absents de la base  : ${cleanNotInBase}`);
  console.log('═'.repeat(70));

  if (toWrite.length > 0) {
    console.log(`\nÉchantillon (${Math.min(sampleSize, toWrite.length)}/${toWrite.length}) :`);
    for (const w of toWrite.slice(0, sampleSize)) {
      const l = w.longevityBreakout ? `${w.longevityBreakout.length} niveaux` : '∅';
      const s = w.sillageBreakout ? `${w.sillageBreakout.length} niveaux` : '∅';
      console.log(`  ${w.id}  longévité:${l}  sillage:${s}`);
    }
  }

  if (!write) {
    console.log('\nDRY-RUN — aucune écriture. Relancer avec --write (et --target=cloud pour la prod) pour appliquer.');
    return;
  }

  let todo = toWrite;
  if (limit > 0) todo = todo.slice(0, limit);
  console.log(`\nApplication de ${todo.length} backfills…`);
  let updated = 0;
  let failed = 0;
  for (let i = 0; i < todo.length; i++) {
    const w = todo[i];
    const { error } = await supabase
      .from('parfums')
      .update({ longevity_breakout: w.longevityBreakout, sillage_breakout: w.sillageBreakout })
      .eq('id', w.id);
    if (error) { failed++; console.warn(`  ✗ ${w.id}: ${error.message}`); } else updated++;
    if ((i + 1) % 100 === 0 || i + 1 === todo.length) {
      process.stdout.write(`\r  ${i + 1}/${todo.length} (à jour: ${updated}, échecs: ${failed})   `);
    }
  }
  console.log(`\n\nTerminé : ${updated} mis à jour, ${failed} échecs.`);
}

main().catch((e) => {
  console.error('Erreur fatale :', (e as Error)?.message ?? e);
  process.exit(1);
});
