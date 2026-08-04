// scripts/voice-vocab.ts — Générateur de vocabulaire vocal (one-shot, rejouable)
// Produit depuis le catalogue cloud :
//   1. Le top N noms de parfums (par popularité) → prompt de transcription
//      (Edge Function transcribe-voice) et biasing STT on-device (contextualStrings).
//   2. TOUTES les marques du catalogue (par popularité) → prompt de transcription
//      (orthographe catalogue) et biasing STT on-device (ASCII).
//
// Contexte : l'ASR français transcrit les noms propres inconnus en mots français
// proches (« Lira Casamorati » → « dire à Casa »). Le vocabulaire explicite est
// le seul levier pour les noms de parfums et les marques niches.
//
//   npx tsx scripts/voice-vocab.ts [--names=400] [--contextual=100] [--out=fichier.txt]

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

function readEnvVar(key: string): string {
  const content = fs.readFileSync(path.resolve('.env'), 'utf8');
  const m = content.match(new RegExp(`^${key}\\s*=\\s*(.+?)\\s*$`, 'm'));
  if (!m) throw new Error(`${key} manquant dans .env`);
  return m[1];
}

function argNum(name: string, fallback: number): number {
  const m = process.argv.find(a => a.startsWith(`--${name}=`));
  if (!m) return fallback;
  const v = Number(m.split('=')[1]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// « Ombré Leather (2018) » → « Ombré Leather » : l'année entre parenthèses
// n'est jamais prononcée, elle ne ferait que diluer le biasing.
function stripYearSuffix(nom: string): string {
  return nom.replace(/\s*\((19|20)\d{2}\)\s*$/, '').trim();
}

// Le STT on-device préfère l'ASCII (convention TOP_BRANDS : « Lancome »).
// Retire les diacritiques, mappe les symboles typographiques (² → 2, ’ → ')
// et supprime ®/™.
function toAscii(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00b2/g, '2')
    .replace(/[\u2018\u2019]/g, '\'')
    .replace(/[\u00ae\u2122]/g, '')
    .trim();
}

interface Row {
  nom: string;
  marque: string;
  rating_count: number | null;
  review_count: number | null;
  popularity_score: number | null;
}

async function main(): Promise<void> {
  const namesCount = argNum('names', 250);
  const contextualCount = argNum('contextual', 100);
  const outArg = process.argv.find(a => a.startsWith('--out='));
  const outPath = outArg ? outArg.split('=')[1] : null;

  const URL = readEnvVar('EXPO_PUBLIC_SUPABASE_URL');
  const ANON = readEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const supabase = createClient(URL, ANON, { auth: { persistSession: false } });

  console.log('═══ Vocabulaire vocal ═══\n');
  console.log(`Lecture du catalogue (chunks de 1000)…`);

  const rows: Row[] = [];
  const CHUNK = 1000;
  for (let from = 0; ; from += CHUNK) {
    // Ordre PK explicite : sans ORDER BY, la pagination PostgREST est instable
    // (duplications + lignes sautées entre chunks).
    const { data, error } = await supabase
      .from('parfums')
      .select('nom, marque, rating_count, review_count, popularity_score')
      .order('id', { ascending: true })
      .range(from, from + CHUNK - 1);
    if (error) throw new Error(`select parfums: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as Row[]));
    if (data.length < CHUNK) break;
  }
  console.log(`${rows.length} parfums lus.\n`);

  const score = (r: Row): number =>
    Math.max(r.rating_count ?? 0, r.review_count ?? 0, r.popularity_score ?? 0);

  // Dédup par nom normalisé (garde l'entrée la plus populaire de chaque nom).
  const byName = new Map<string, Row>();
  for (const r of rows) {
    if (!r.nom || !r.marque) continue;
    const key = normalize(r.nom);
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev || score(r) > score(prev)) byName.set(key, r);
  }
  const topNames = [...byName.values()].sort((a, b) => score(b) - score(a)).slice(0, namesCount);

  // 1. Liste pour le prompt de transcription (virgules, comme BRAND_PROMPT).
  //    Orthographe catalogue (accents officiels), année entre parenthèses retirée.
  const promptNames = [...new Set(topNames.map(r => stripYearSuffix(r.nom)))];
  console.log(`── TOP ${promptNames.length} NOMS (prompt transcribe-voice) ──`);
  console.log(promptNames.join(', '));

  // 2. Array TS pour contextualStrings (biasing STT on-device) — ASCII.
  const contextual = [...new Set(topNames.slice(0, contextualCount).map(r => toAscii(stripYearSuffix(r.nom))))];
  console.log(`\n── TOP ${contextual.length} NOMS (contextualStrings, array TS) ──`);
  const chunks: string[] = [];
  for (let i = 0; i < contextual.length; i += 5) {
    chunks.push('  ' + contextual.slice(i, i + 5).map(n => `'${n.replace(/'/g, "\\'")}'`).join(', ') + ',');
  }
  console.log(chunks.join('\n'));

  // 3. TOUTES les marques du catalogue (par popularité) — pour le prompt de
  //    transcription serveur et le biasing STT client.
  const byBrand = new Map<string, { marque: string; best: number }>();
  for (const r of rows) {
    if (!r.marque) continue;
    const key = normalize(r.marque);
    const prev = byBrand.get(key);
    if (!prev || score(r) > prev.best) byBrand.set(key, { marque: r.marque, best: score(r) });
  }
  const allBrands = [...byBrand.values()].sort((a, b) => b.best - a.best);
  console.log(`\n── TOUTES LES MARQUES DU CATALOGUE (${allBrands.length}, par popularité) ──`);
  console.log(allBrands.map(b => b.marque).join(', '));
  const brandsAscii = allBrands.map(b => toAscii(b.marque));
  const brandChunks: string[] = [];
  for (let i = 0; i < brandsAscii.length; i += 5) {
    brandChunks.push('  ' + brandsAscii.slice(i, i + 5).map(n => `'${n.replace(/'/g, "\\'")}'`).join(', ') + ',');
  }
  console.log(`\n── MARQUES CATALOGUE (array TS, ASCII, biasing client) ──`);
  console.log(brandChunks.join('\n'));

  if (outPath) {
    const asTsArray = (items: string[], perLine: number): string => {
      const lines: string[] = [];
      for (let i = 0; i < items.length; i += perLine) {
        lines.push('  ' + items.slice(i, i + perLine).map(n => `'${n.replace(/'/g, "\\'")}'`).join(', ') + ',');
      }
      return lines.join('\n');
    };
    const content = [
      `── TOP ${promptNames.length} NOMS (prompt transcribe-voice, array TS) ──`,
      asTsArray(promptNames, 4),
      '',
      `── TOP ${contextual.length} NOMS (contextualStrings, array TS ASCII) ──`,
      asTsArray(contextual, 4),
      '',
      `── TOUTES LES MARQUES DU CATALOGUE (${allBrands.length}, orthographe catalogue) ──`,
      asTsArray(allBrands.map(b => b.marque), 4),
      '',
      `── MARQUES CATALOGUE (array TS, ASCII, biasing client) ──`,
      asTsArray(brandsAscii, 4),
      '',
    ].join('\n');
    fs.writeFileSync(outPath, content, 'utf8');
    console.log(`\nSortie écrite dans ${outPath}`);
  }
}

main().catch(e => {
  console.error('Échec:', (e as Error).message);
  process.exit(1);
});
