/**
 * Backfill longévité & sillage — répare la base existante SANS re-scraper.
 *
 * Contexte : la base a été peuplée par une ancienne chaîne qui convertissait la
 * moyenne des votes Fragrantica en label avec des seuils décalés (off-by-one),
 * promouvant la longévité d'un cran (ex. Allure Homme, moyenne 3,28 → "long
 * lasting" au lieu de "moderate"). La moyenne numérique EST conservée dans
 * data/clean (`longevityAverage` / `sillageAverage`) → on peut recalculer la
 * bonne string pour chaque parfum et corriger la base.
 *
 * Le matching clean ↔ base se fait par id BDD = normaliseId(marque_nom), la même
 * formule qu'import-fresh (parfumIdFromTitle).
 *
 * Usage :
 *   npm run backfill-performance                       DRY-RUN : rapport des divergences (défaut)
 *   npm run backfill-performance -- --write            applique en local (Docker)
 *   npm run backfill-performance -- --write --target=cloud
 *   npm run backfill-performance -- --limit=500        plafonne le nombre d'updates
 *   npm run backfill-performance -- --sample=20        taille de l'échantillon affiché
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readEnvVar, argValue, hasFlag } from '../lib/script-utils';
import { parfumIdFromTitle } from '../lib/title';
import { longevityString, sillageString } from '../lib/perf-strings';

const CLEAN_DIR = path.resolve('data', 'clean');
const LOCAL_URL = 'http://127.0.0.1:54321';
const PAGE_SIZE = 1000;

interface CleanPerf {
  id: string;
  longevity: string | null;
  sillage: string | null;
}

interface BasePerf {
  id: string;
  longevity: string | null;
  sillage: string | null;
}

function readClean(): Map<string, CleanPerf> {
  const map = new Map<string, CleanPerf>();
  const files = fs.readdirSync(CLEAN_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    let entries: { title?: string; brandName?: string; longevityAverage?: number | null; sillageAverage?: number | null }[];
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
        longevity: longevityString(e.longevityAverage),
        sillage: sillageString(e.sillageAverage),
      });
    }
  }
  return map;
}

async function readBase(supabase: SupabaseClient): Promise<Map<string, BasePerf>> {
  const map = new Map<string, BasePerf>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('parfums')
      .select('id, longevity, sillage')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`lecture base: ${error.message}`);
    const rows = data ?? [];
    for (const r of rows) map.set(r.id as string, { id: r.id as string, longevity: r.longevity as string | null, sillage: r.sillage as string | null });
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return map;
}

interface Divergence {
  id: string;
  base: BasePerf;
  expected: CleanPerf;
  kind: 'longevity' | 'sillage' | 'both';
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

  console.log('Lecture de la base…');
  const base = await readBase(supabase);
  console.log(`  ${base.size} parfums en base.\n`);

  let matched = 0;
  let skippedNoVote = 0;
  let cleanNotInBase = 0;
  const divergences: Divergence[] = [];

  for (const [id, expected] of clean) {
    const baseRow = base.get(id);
    if (!baseRow) { cleanNotInBase++; continue; }
    matched++;
    const expL = expected.longevity;
    const expS = expected.sillage;
    if (expL === null && expS === null) { skippedNoVote++; continue; }

    const longDiff = expL !== null && baseRow.longevity !== expL;
    const sillDiff = expS !== null && baseRow.sillage !== expS;
    if (longDiff || sillDiff) {
      divergences.push({
        id,
        base: baseRow,
        expected,
        kind: longDiff && sillDiff ? 'both' : longDiff ? 'longevity' : 'sillage',
      });
    }
  }

  console.log('═'.repeat(70));
  console.log(`Matchés clean↔base        : ${matched}`);
  console.log(`Clean sans vote (skippés) : ${skippedNoVote}`);
  console.log(`Clean absents de la base  : ${cleanNotInBase}`);
  console.log(`DIVERGENCES               : ${divergences.length}`);
  const byLong = divergences.filter((d) => d.kind === 'longevity').length;
  const bySill = divergences.filter((d) => d.kind === 'sillage').length;
  const byBoth = divergences.filter((d) => d.kind === 'both').length;
  console.log(`  · longévité seule       : ${byLong}`);
  console.log(`  · sillage seul          : ${bySill}`);
  console.log(`  · les deux              : ${byBoth}`);
  console.log('═'.repeat(70));

  if (divergences.length > 0) {
    console.log(`\nÉchantillon (avant → attendu), ${Math.min(sampleSize, divergences.length)}/${divergences.length} :`);
    for (const d of divergences.slice(0, sampleSize)) {
      const l = d.base.longevity !== d.expected.longevity ? `  longévité: ${d.base.longevity ?? '∅'} → ${d.expected.longevity ?? '∅'}` : '';
      const s = d.base.sillage !== d.expected.sillage ? `  sillage: ${d.base.sillage ?? '∅'} → ${d.expected.sillage ?? '∅'}` : '';
      console.log(`  ${d.id}${l}${s}`);
    }
  }

  if (!write) {
    console.log('\nDRY-RUN — aucune écriture. Relancer avec --write (et --target=cloud pour la prod) pour appliquer.');
    return;
  }

  let todo = divergences;
  if (limit > 0) todo = todo.slice(0, limit);
  console.log(`\nApplication de ${todo.length} corrections…`);
  let updated = 0;
  let failed = 0;
  for (let i = 0; i < todo.length; i++) {
    const d = todo[i];
    const patch: Record<string, string | null> = {};
    if (d.base.longevity !== d.expected.longevity) patch.longevity = d.expected.longevity;
    if (d.base.sillage !== d.expected.sillage) patch.sillage = d.expected.sillage;
    const { error } = await supabase.from('parfums').update(patch).eq('id', d.id);
    if (error) { failed++; console.warn(`  ✗ ${d.id}: ${error.message}`); } else updated++;
    if ((i + 1) % 50 === 0 || i + 1 === todo.length) {
      process.stdout.write(`\r  ${i + 1}/${todo.length} (à jour: ${updated}, échecs: ${failed})   `);
    }
  }
  console.log(`\n\nTerminé : ${updated} mis à jour, ${failed} échecs.`);
}

main().catch((e) => {
  console.error('Erreur fatale :', (e as Error)?.message ?? e);
  process.exit(1);
});
