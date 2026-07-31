import * as fs from 'fs';
import * as path from 'path';
import { todayStamp } from '../lib/fragrantica';
import type { DesignerEntry } from './scrape-designers';

/**
 * Étage 1 — Watch : snapshot de data/designers.json + diff vs snapshot précédent.
 *
 * Détecte, sans re-scraper Fragrantica (le scrape est fait par scrape-designers) :
 *   - les marques apparues (nouvelles sur Fragrantica)
 *   - les marques disparues (retirées/renommées)
 *   - les deltas de compteur (parfums ajoutés/retirés chez une marque)
 *
 * Sorties :
 *   data/designers-history/designers-<date>.json  — snapshot daté (référence du prochain run)
 *   data/watch/delta-<date>.json                  — rapport de diff (consommé par diff-brands)
 *
 * Usage : npm run watch-designers   (après npm run scrape-designers)
 */

export interface CountChange {
  slug: string;
  name: string;
  before: number;
  after: number;
  delta: number;
}

export interface WatchDelta {
  date: string;
  previousDate: string | null;
  totalBrands: number;
  newBrands: DesignerEntry[];
  removedBrands: DesignerEntry[];
  countChanges: CountChange[];
}

const DATA_FILE = path.resolve('data', 'designers.json');
const HISTORY_DIR = path.resolve('data', 'designers-history');
const WATCH_DIR = path.resolve('data', 'watch');

function loadDesigners(file: string): DesignerEntry[] {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as DesignerEntry[];
}

function latestSnapshot(): string | null {
  if (!fs.existsSync(HISTORY_DIR)) return null;
  const files = fs.readdirSync(HISTORY_DIR).filter((f) => f.endsWith('.json')).sort();
  return files.length > 0 ? path.join(HISTORY_DIR, files[files.length - 1]) : null;
}

function snapshotDate(file: string): string {
  return path.basename(file).replace(/^designers-/, '').replace(/\.json$/, '');
}

function diff(current: DesignerEntry[], previous: DesignerEntry[]): Pick<WatchDelta, 'newBrands' | 'removedBrands' | 'countChanges'> {
  const prevBySlug = new Map(previous.map((e) => [e.slug, e]));
  const currBySlug = new Map(current.map((e) => [e.slug, e]));

  const newBrands = current.filter((e) => !prevBySlug.has(e.slug));
  const removedBrands = previous.filter((e) => !currBySlug.has(e.slug));
  const countChanges: CountChange[] = [];
  for (const e of current) {
    const prev = prevBySlug.get(e.slug);
    if (prev && prev.count !== e.count) {
      countChanges.push({ slug: e.slug, name: e.name, before: prev.count, after: e.count, delta: e.count - prev.count });
    }
  }
  countChanges.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { newBrands, removedBrands, countChanges };
}

function main(): void {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ ${DATA_FILE} introuvable — lance d'abord : npm run scrape-designers`);
    process.exit(1);
  }

  const current = loadDesigners(DATA_FILE);
  const today = todayStamp();
  const prevFile = latestSnapshot();

  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  fs.mkdirSync(WATCH_DIR, { recursive: true });

  if (!prevFile) {
    // Premier run : baseline de référence, pas de delta (évite 8000 « nouvelles marques »)
    const delta: WatchDelta = {
      date: today,
      previousDate: null,
      totalBrands: current.length,
      newBrands: [],
      removedBrands: [],
      countChanges: [],
    };
    const snapshotPath = path.join(HISTORY_DIR, `designers-${today}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(current, null, 2) + '\n', 'utf8');
    const deltaPath = path.join(WATCH_DIR, `delta-${today}.json`);
    fs.writeFileSync(deltaPath, JSON.stringify(delta, null, 2) + '\n', 'utf8');
    console.log(`📸 Baseline créée : ${current.length} marques (${snapshotPath})`);
    console.log(`   Le prochain run de scrape-designers + watch-designers détectera les changements.`);
    return;
  }

  const previous = loadDesigners(prevFile);
  const { newBrands, removedBrands, countChanges } = diff(current, previous);

  const delta: WatchDelta = {
    date: today,
    previousDate: snapshotDate(prevFile),
    totalBrands: current.length,
    newBrands,
    removedBrands,
    countChanges,
  };

  const deltaPath = path.join(WATCH_DIR, `delta-${today}.json`);
  fs.writeFileSync(deltaPath, JSON.stringify(delta, null, 2) + '\n', 'utf8');
  const snapshotPath = path.join(HISTORY_DIR, `designers-${today}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify(current, null, 2) + '\n', 'utf8');

  console.log(`📊 Diff ${delta.previousDate} → ${today} (${current.length} marques)\n`);
  console.log(`  🆕 Marques apparues   : ${newBrands.length}`);
  for (const b of newBrands.slice(0, 10)) console.log(`     + ${b.name} (${b.count})`);
  if (newBrands.length > 10) console.log(`     … +${newBrands.length - 10} autres`);
  console.log(`  🗑️  Marques disparues  : ${removedBrands.length}`);
  for (const b of removedBrands.slice(0, 5)) console.log(`     − ${b.name} (${b.count})`);
  console.log(`  🔢 Deltas de compteur : ${countChanges.length}`);
  for (const c of countChanges.slice(0, 15)) {
    const sign = c.delta > 0 ? '+' : '−';
    console.log(`     ${sign}${Math.abs(c.delta)} ${c.name} (${c.before} → ${c.after})`);
  }
  if (countChanges.length > 15) console.log(`     … +${countChanges.length - 15} autres`);
  console.log(`\n   → ${deltaPath}`);
  if (newBrands.length > 0 || countChanges.length > 0) {
    console.log(`   Étape suivante : npm run diff-brands -- --target=cloud`);
  }
}

main();
