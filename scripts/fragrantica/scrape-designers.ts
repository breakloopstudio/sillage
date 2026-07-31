import * as fs from 'fs';
import * as path from 'path';
import {
  FRAGRANTICA_BASE,
  decodeEntities,
  fetchFragrantica,
  sleepJitter,
  stripTags,
} from '../lib/fragrantica';

/**
 * Scrape la liste complète des marques Fragrantica + nombre de parfums par marque.
 *
 * Source : https://www.fragrantica.com/designers/
 * La page d'accueil ne montre que les marques populaires — la liste complète
 * est paginée sur 11 pages : /designers-1/ (A) … /designers-11/ (T→Z).
 *
 * Sortie :
 *   data/designers.json  — [{ name, slug, count }] trié alphabétiquement
 *   data/designers.csv   — name,count,slug
 *
 * Usage : npm run scrape-designers
 * Chaîne : npm run watch-designers ensuite (snapshot + diff vs run précédent)
 */

export interface DesignerEntry {
  name: string;
  slug: string;
  count: number;
}

const PAGE_COUNT = 11;
const DELAY_MS = 400;
const OUT_DIR = path.resolve('data');

// Marques commençant par un chiffre : ABSENTES de l'index A–Z (vérifié : aucune
// nav « # », /designers-0/ et /designers-12/ → 404, page 1 sans trace). Leurs
// pages existent → on les récupère individuellement (count via la page de marque).
const EXTRA_SLUGS = ['4711', '4160-Tuesdays', '100-Bon', '19-69', '10-Corso-Como', '24', '27-87'];

// Chaque entrée : <a href="/designers/<slug>.html" ...><span class="absolute inset-0"></span> Nom </a>
// suivie d'un <span ...> compteur. Le pattern strict écarte les liens designers des sidebars.
const ENTRY_RE =
  /href="\/designers\/([^"]+)\.html"[^>]*>\s*<span class="absolute inset-0"><\/span>\s*([\s\S]*?)<\/a>\s*<span[^>]*>\s*(\d+)\s*<\/span>/g;

// Page de marque (pour EXTRA_SLUGS) : « Designer <b>Nom</b> has <b>83</b> perfumes in our fragrance base. »
const BRAND_COUNT_RE = /Designer <b>([^<]+)<\/b> has <b>(\d+)<\/b> perfumes? in our fragrance base/i;

function parsePage(html: string): DesignerEntry[] {
  const entries: DesignerEntry[] = [];
  let m: RegExpExecArray | null;
  ENTRY_RE.lastIndex = 0;
  while ((m = ENTRY_RE.exec(html)) !== null) {
    const [, slug, rawName, rawCount] = m;
    const name = decodeEntities(stripTags(rawName)).trim();
    const count = parseInt(rawCount, 10);
    if (!name || !Number.isFinite(count)) continue;
    entries.push({ name, slug, count });
  }
  return entries;
}

function parseBrandPage(html: string, slug: string): DesignerEntry | null {
  const m = BRAND_COUNT_RE.exec(html);
  if (!m) return null;
  const name = decodeEntities(m[1]).trim();
  const count = parseInt(m[2], 10);
  if (!name || !Number.isFinite(count)) return null;
  return { name, slug, count };
}

async function main(): Promise<void> {
  console.log(`🔎 Scraping Fragrantica designers (${PAGE_COUNT} pages)…\n`);

  const bySlug = new Map<string, DesignerEntry>();

  for (let page = 1; page <= PAGE_COUNT; page++) {
    const url = `${FRAGRANTICA_BASE}/designers-${page}/`;
    const html = await fetchFragrantica(url);
    const entries = parsePage(html);
    let added = 0;
    for (const e of entries) {
      if (!bySlug.has(e.slug)) {
        bySlug.set(e.slug, e);
        added++;
      }
    }
    console.log(`  📄 page ${String(page).padStart(2)}/${PAGE_COUNT} : ${entries.length} marques (${added} nouvelles)`);
    if (page < PAGE_COUNT) await sleepJitter(DELAY_MS);
  }

  // Marques hors index (commençant par un chiffre) — pages de marque individuelles
  console.log('');
  for (const slug of EXTRA_SLUGS) {
    const url = `${FRAGRANTICA_BASE}/designers/${slug}.html`;
    const html = await fetchFragrantica(url);
    const entry = parseBrandPage(html, slug);
    if (entry && !bySlug.has(entry.slug)) {
      bySlug.set(entry.slug, entry);
      console.log(`  🔢 ${entry.name} : ${entry.count} parfums`);
    } else if (!entry) {
      console.warn(`  ⚠️  ${slug} : compteur introuvable sur la page de marque`);
    }
    await sleepJitter(DELAY_MS);
  }

  const all = [...bySlug.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
  );

  if (all.length === 0) {
    console.error('\n❌ Aucune marque extraite — la structure de la page a probablement changé.');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const jsonPath = path.join(OUT_DIR, 'designers.json');
  fs.writeFileSync(jsonPath, JSON.stringify(all, null, 2) + '\n', 'utf-8');

  const csvPath = path.join(OUT_DIR, 'designers.csv');
  const csvRows = [
    'name,count,slug',
    ...all.map((e) => `"${e.name.replace(/"/g, '""')}",${e.count},${e.slug}`),
  ];
  fs.writeFileSync(csvPath, csvRows.join('\n') + '\n', 'utf-8');

  const totalParfums = all.reduce((sum, e) => sum + e.count, 0);
  console.log(`\n✅ ${all.length} marques, ${totalParfums.toLocaleString('fr-FR')} parfums référencés`);
  console.log(`   → ${jsonPath}`);
  console.log(`   → ${csvPath}`);
}

main().catch((err) => {
  console.error('❌ Échec du scraping :', err);
  process.exit(1);
});
