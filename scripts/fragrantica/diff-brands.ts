import * as fs from 'fs';
import * as path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  FRAGRANTICA_BASE,
  fetchFragrantica,
  normaliseId,
  normaliseTexte,
  parseBrandPerfumeCards,
  sleepJitter,
  todayStamp,
} from '../lib/fragrantica';
import { argValue, hasFlag, readEnvVar } from '../lib/script-utils';
import type { CountChange, WatchDelta } from './watch-designers';

/**
 * Étage 2 — Diff marque : pour les marques à changement (dernier delta du watch,
 * ou liste manuelle), scrape la page de marque Fragrantica et compare à la BDD.
 *
 * La comparaison utilise la MÊME formule d'id qu'import-fresh :
 *   id = normaliseId(`${marque}_${nom}`)
 * → un parfum du site dont l'id est absent de la BDD est un nouveau parfum.
 *
 * Sortie : data/watch/queue-<date>.json — file des nouveaux parfums détectés
 * (consommée par l'étage 3, scraper de fiches). Aucune écriture en BDD.
 *
 * Usage :
 *   npm run diff-brands                              # dernier delta, cible locale (Docker)
 *   npm run diff-brands -- --target=cloud            # cible cloud (.env)
 *   npm run diff-brands -- --brands=4711,24          # marques manuelles (slugs)
 *   npm run diff-brands -- --delta=data/watch/delta-2026-07-30.json
 *   npm run diff-brands -- --all-new-brands          # inclut aussi les marques apparues du delta
 *   npm run diff-brands -- --out=data/watch/queue-test.json
 */

interface BrandPerfume {
  nom: string;
  year: number | null;
  url: string;
  fragranticaId: string;
}

interface BrandQueue {
  slug: string;
  name: string;
  reason: 'count-delta' | 'new-brand' | 'manual';
  countBefore: number | null;
  countAfter: number | null;
  onFragrantica: number;
  alreadyInDb: number;
  new: BrandPerfume[];
  missingFromFragrantica: string[];
  error?: string;
}

interface QueueFile {
  date: string;
  target: 'local' | 'cloud';
  brands: BrandQueue[];
  totals: { brands: number; newPerfumes: number; alreadyInDb: number; missing: number };
}

const WATCH_DIR = path.resolve('data', 'watch');
const LOCAL_URL = 'http://127.0.0.1:54321';
const PAGE_SIZE = 1000;
const DELAY_MS = 400;

// ---------------------------------------------------------------------------
// BDD : ids existants (lecture seule)
// ---------------------------------------------------------------------------

async function fetchDbParfums(supabase: SupabaseClient): Promise<Map<string, Set<string>>> {
  // Map normaliseTexte(marque) → Set(ids) — le groupage exact par marque sert au
  // calcul des « manquants » ; l'union de tous les ids sert au test « déjà en base ».
  const byMarque = new Map<string, Set<string>>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('parfums')
      .select('id, marque')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`lecture parfums : ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data as { id: string; marque: string }[]) {
      const key = normaliseTexte(row.marque);
      let set = byMarque.get(key);
      if (!set) {
        set = new Set();
        byMarque.set(key, set);
      }
      set.add(row.id);
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return byMarque;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const cloud = hasFlag('cloud') || argValue('target') === 'cloud';
  const outFile = argValue('out');
  const manualBrands = argValue('brands')
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // 1) Déterminer les marques à traiter
  type BrandInput = { slug: string; name: string; reason: BrandQueue['reason']; before: number | null; after: number | null };
  let brands: BrandInput[] = [];

  if (manualBrands && manualBrands.length > 0) {
    brands = manualBrands.map((slug) => ({ slug, name: slug.replace(/-/g, ' '), reason: 'manual' as const, before: null, after: null }));
  } else {
    const deltaFile = argValue('delta') ?? latestDeltaFile();
    if (!deltaFile) {
      console.error(`❌ Aucun delta dans ${WATCH_DIR} — lance d'abord : npm run watch-designers`);
      process.exit(1);
    }
    const delta = JSON.parse(fs.readFileSync(deltaFile, 'utf8')) as WatchDelta;
    console.log(`Delta du ${delta.date} (réf. ${delta.previousDate ?? 'baseline'}) : ${delta.countChanges.length} deltas, ${delta.newBrands.length} marques apparues\n`);
    brands = delta.countChanges.map((c: CountChange) => ({ slug: c.slug, name: c.name, reason: 'count-delta' as const, before: c.before, after: c.after }));
    if (hasFlag('all-new-brands')) {
      brands.push(...delta.newBrands.map((b) => ({ slug: b.slug, name: b.name, reason: 'new-brand' as const, before: null, after: b.count })));
    }
  }

  if (brands.length === 0) {
    console.log('Aucune marque à traiter (delta vide).');
    return;
  }

  // 2) Connexion BDD (lecture seule)
  const supaUrl = cloud ? readEnvVar('EXPO_PUBLIC_SUPABASE_URL') : LOCAL_URL;
  const supaKey = cloud ? readEnvVar('SUPABASE_SERVICE_ROLE_KEY') : readEnvVar('SUPABASE_LOCAL_SERVICE_ROLE');
  if (!supaUrl || !supaKey) {
    console.error(cloud
      ? 'EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env'
      : 'Mode local : SUPABASE_LOCAL_SERVICE_ROLE manquant dans .env (voir `supabase status`).');
    process.exit(1);
  }
  const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log(`Cible : ${cloud ? 'CLOUD' : 'LOCALE'} (${supaUrl})`);
  const byMarque = await fetchDbParfums(supabase);
  const allDbIds = new Set<string>();
  for (const set of byMarque.values()) for (const id of set) allDbIds.add(id);
  console.log(`${allDbIds.size} parfums en base, ${brands.length} marques à comparer.\n`);

  // 3) Scrape + diff par marque
  const queue: QueueFile = {
    date: todayStamp(),
    target: cloud ? 'cloud' : 'local',
    brands: [],
    totals: { brands: 0, newPerfumes: 0, alreadyInDb: 0, missing: 0 },
  };

  for (const [i, b] of brands.entries()) {
    const entry: BrandQueue = {
      slug: b.slug,
      name: b.name,
      reason: b.reason,
      countBefore: b.before,
      countAfter: b.after,
      onFragrantica: 0,
      alreadyInDb: 0,
      new: [],
      missingFromFragrantica: [],
    };
    queue.brands.push(entry);

    let html: string;
    try {
      html = await fetchFragrantica(`${FRAGRANTICA_BASE}/designers/${b.slug}.html`);
    } catch (err) {
      entry.error = (err as Error).message.split('\n')[0];
      console.warn(`  ⚠️  [${i + 1}/${brands.length}] ${b.name} : échec fetch — ${entry.error}`);
      await sleepJitter(DELAY_MS);
      continue;
    }

    const perfumes = parseBrandPerfumeCards(html, b.name);
    entry.onFragrantica = perfumes.length;

    const siteIds = new Set<string>();
    const dbIdsForBrand = byMarque.get(normaliseTexte(b.name)) ?? new Set<string>();

    for (const p of perfumes) {
      const id = normaliseId(`${p.designer}_${p.nom}`);
      siteIds.add(id);
      if (allDbIds.has(id)) {
        entry.alreadyInDb++;
      } else {
        entry.new.push({ nom: p.nom, year: p.year, url: p.url, fragranticaId: p.fragranticaId });
      }
    }
    for (const id of dbIdsForBrand) {
      if (!siteIds.has(id)) entry.missingFromFragrantica.push(id);
    }

    queue.totals.newPerfumes += entry.new.length;
    queue.totals.alreadyInDb += entry.alreadyInDb;
    queue.totals.missing += entry.missingFromFragrantica.length;

    console.log(
      `  [${String(i + 1).padStart(3)}/${brands.length}] ${b.name} : ${entry.onFragrantica} sur le site, ` +
        `${entry.alreadyInDb} en base, ${entry.new.length} nouveau(x), ${entry.missingFromFragrantica.length} manquant(s)`,
    );
    await sleepJitter(DELAY_MS);
  }

  queue.totals.brands = queue.brands.length;

  // 4) Écriture de la file
  fs.mkdirSync(WATCH_DIR, { recursive: true });
  const queuePath = outFile ?? path.join(WATCH_DIR, `queue-${todayStamp()}.json`);
  fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2) + '\n', 'utf8');

  console.log(`\n✅ ${queue.totals.brands} marques comparées → ${queue.totals.newPerfumes} nouveaux parfums détectés`);
  if (queue.totals.missing > 0) {
    console.log(`   ℹ️  ${queue.totals.missing} parfums en base absents du site (info seulement — jamais supprimés automatiquement)`);
  }
  console.log(`   → ${queuePath}`);
  if (queue.totals.newPerfumes > 0) {
    console.log(`   Étape suivante (étage 3) : scraper les fiches de la file au format data/clean, puis npm run import-fresh`);
  }
}

function latestDeltaFile(): string | null {
  if (!fs.existsSync(WATCH_DIR)) return null;
  const files = fs.readdirSync(WATCH_DIR).filter((f) => f.startsWith('delta-') && f.endsWith('.json')).sort();
  return files.length > 0 ? path.join(WATCH_DIR, files[files.length - 1]) : null;
}

main().catch((err) => {
  console.error('❌ Échec du diff :', err);
  process.exit(1);
});
