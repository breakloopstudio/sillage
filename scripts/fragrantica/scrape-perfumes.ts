import * as fs from 'fs';
import * as path from 'path';
import {
  FRAGRANTICA_BASE,
  decodeEntities,
  fetchFragrantica,
  parseBrandPerfumeCards,
  sleepJitter,
  stripTags,
} from '../lib/fragrantica';
import { decryptPayload, type EncryptedPayload } from '../lib/fragrantica-decrypt';
import { argValue, hasFlag } from '../lib/script-utils';
import { parfumIdFromTitle } from '../lib/title';

/**
 * Étape 3 — Scrape des fiches parfums Fragrantica au format data/raw (Apify-compatible).
 *
 * Produit des entrées au MÊME schéma que les JSON Apify de data/raw/ → la
 * pipeline existante chaîne sans modification :
 *   npm run scrape-perfumes   → data/raw/<Marque>.json
 *   npm run clean-data        → data/clean/<Marque>.json
 *   npm run import-fresh      → Postgres + Storage
 *
 * Sources des champs :
 *   - HTML server-rendered : H1 (nom+marque), description, accords (barres),
 *     pyramide de notes, nez, rating, reviewCount, images (URLs déterministes)
 *   - `let status = {...}` (payload chiffré) : distributions de votes (longevity,
 *     sillage, price value, rating, saisons, gender, relation) — déchiffré via
 *     scripts/lib/fragrantica-decrypt.ts (chunk officiel vendorisé)
 *
 * Entrées (au choix) :
 *   (défaut)  dernière file data/watch/queue-*.json (sortie de l'étage 2)
 *   --queue=<fichier>
 *   --brands=4711,24                      marques entières (toutes leurs fiches)
 *   --urls=/perfume/Dior/X-123.html,...   fiches précises
 *
 * Options : --format=raw|clean|both (défaut raw) · --out-dir=<dir> · --limit=N ·
 *           --delay=400 · --refresh (ignore le checkpoint) · --dry-run
 *
 * --format=raw   : chaîne historique → npm run clean-data → import-fresh
 * --format=clean : v2, écrit directement data/clean (merge par id calculée,
 *                  même formule qu'import-fresh) → import-fresh directement.
 *                  ⚠️ ne PAS relancer clean-data derrière (entrées perdues).
 * --format=both  : les deux (raw reste la source canonique, clean déjà à jour).
 *
 * Idempotent + resumable (checkpoint data/migration/scrape-perfumes-progress.json).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawNote {
  name: string;
  img?: string;
  url?: string;
}

interface RawPyramid {
  type: 'full' | 'single';
  topNotes?: RawNote[];
  middleNotes?: RawNote[];
  baseNotes?: RawNote[];
  allNotes?: RawNote[];
}

interface RawEntry {
  id: string;
  url: string;
  title: string;
  description: string | null;
  primaryImageUrl: string;
  images: string[];
  brandName: string;
  brandUrl: string;
  brandLogo: string | null;
  mainAccords: { accord: string; value: number }[];
  pros: unknown[];
  cons: unknown[];
  pyramid: RawPyramid | null;
  longevityBreakout: Record<string, number>[];
  longevityAverage: number | null;
  longevitySum: number | null;
  longevityMax: number | null;
  sillageBreakout: Record<string, number>[];
  sillageAverage: number | null;
  sillageSum: number | null;
  sillageMax: number | null;
  priceValueBreakout: Record<string, number>[];
  priceValueAverage: number | null;
  priceValueSum: number | null;
  priceValueMax: number | null;
  perfumeRating: number | null;
  ratingBreakout: Record<string, number>[];
  ratingAverage: number | null;
  ratingSum: number | null;
  ratingMax: number | null;
  bestRating: number;
  ratingCount: number | null;
  reviewCount: number | null;
  gender: string | null;
  genderBreakout: { female: number; femaleUnisex: number; unisex: number; male: number; maleUnisex: number } | null;
  genderSum: number | null;
  genderMax: number | null;
  thisPerfumeRemindsMeOf: unknown[];
  seasonBreakout: Record<string, number> | null;
  relationBreakout: Record<string, number> | null;
  relationSum: number | null;
  relationMax: number | null;
  perfumers: string[];
  peopleWhoLikeThisAlsoLike: unknown[];
  reviews: unknown[];
}

interface PerfumeJob {
  url: string;
  fragranticaId: string;
  brandNameHint?: string;
}

interface StatusData {
  status: {
    longevity?: Record<string, number>;
    longevity_sum?: number;
    longevity_max?: number;
    sillage?: Record<string, number>;
    sillage_sum?: number;
    sillage_max?: number;
    price_value?: Record<string, number>;
    price_value_sum?: number;
    price_value_max?: number;
    rating?: Record<string, number>;
    rating_sum?: number;
    rating_max?: number;
    winter?: number;
    spring?: number;
    summer?: number;
    autumn?: number;
    day?: number;
    night?: number;
    gender?: { female?: number; female_unisex?: number; unisex?: number; male_unisex?: number; male?: number };
    gender_sum?: number;
    gender_max?: number;
    relation?: { have?: number; had?: number; want?: number };
    relation_sum?: number;
    relation_max?: number;
    people?: number;
  };
}

// ---------------------------------------------------------------------------
// Constantes + args
// ---------------------------------------------------------------------------

const LONGEVITY_LABELS = ['very weak', 'weak', 'moderate', 'long lasting', 'eternal'];
const SILLAGE_LABELS = ['intimate', 'moderate', 'strong', 'enormous'];
const PRICE_VALUE_LABELS = ['way overpriced', 'overpriced', 'ok', 'good value', 'great value'];
const RATING_LABELS = ['hate', 'dislike', 'ok', 'like', 'love'];
const PROGRESS_FILE = path.resolve('data/migration/scrape-perfumes-progress.json');
const WATCH_DIR = path.resolve('data', 'watch');

// ---------------------------------------------------------------------------
// Extraction HTML (server-rendered)
// ---------------------------------------------------------------------------

function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function extractH1(html: string): { h1Text: string; genderText: string } | null {
  const h1M = /<h1 itemprop="name"[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  if (!h1M) return null;
  const genderM = /<span[^>]*>\s*(for (?:women and men|women|men))\s*<\/span>/.exec(h1M[1]);
  const h1Text = collapseWs(stripTags(decodeEntities(h1M[1].replace(/<span[\s\S]*?<\/span>/g, ' '))));
  return { h1Text, genderText: genderM ? genderM[1] : '' };
}

function extractTitleTag(html: string): string {
  const m = /<title>([\s\S]*?)<\/title>/.exec(html);
  return m ? decodeEntities(m[1]).trim() : '';
}

function extractDescription(html: string): string | null {
  const mainM = /<p><b>[\s\S]*?<\/b>\s*by\s*<b>[\s\S]*?<\/b>[\s\S]*?<\/p>/.exec(html);
  if (!mainM) return null;
  const main = collapseWs(stripTags(decodeEntities(mainM[0])));
  const bqM = /<div v-pre class='fragrantica-blockquote'><p>([\s\S]*?)<\/p><\/div>/.exec(html);
  const bq = bqM ? collapseWs(stripTags(decodeEntities(bqM[1]))) : '';
  return bq ? `${main} ${bq}` : main;
}

function extractAccords(html: string): { accord: string; value: number }[] {
  const start = html.indexOf('main accords');
  if (start === -1) return [];
  const end = html.indexOf('accords-search', start);
  const section = html.slice(start, end === -1 ? start + 6000 : end);
  const out: { accord: string; value: number }[] = [];
  const re = /width:\s*([\d.]+)%;[^>]*>\s*<span class="truncate">([^<]+)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    const value = Math.round(parseFloat(m[1]) * 100) / 100;
    const accord = decodeEntities(m[2]).trim();
    if (accord && Number.isFinite(value)) out.push({ accord, value });
  }
  return out;
}

function extractPyramid(html: string): RawPyramid | null {
  const levelRe = /<pyramid-level-new notes="([^"]+)">([\s\S]*?)<\/pyramid-level-new>/g;
  const noteRe = /<a href="((?:https:\/\/www\.fragrantica\.com)?\/notes\/[^"]+)"[\s\S]*?src="([^"]+)"[\s\S]*?pyramid-note-label[^>]*>\s*([\s\S]*?)\s*<\/span>/g;
  const levels = new Map<string, RawNote[]>();
  let lm: RegExpExecArray | null;
  while ((lm = levelRe.exec(html)) !== null) {
    const [, level, block] = lm;
    const notes: RawNote[] = [];
    let nm: RegExpExecArray | null;
    noteRe.lastIndex = 0;
    while ((nm = noteRe.exec(block)) !== null) {
      const url = nm[1].startsWith('http') ? nm[1] : `${FRAGRANTICA_BASE}${nm[1]}`;
      const name = collapseWs(decodeEntities(stripTags(nm[3])));
      if (name) notes.push({ name, img: nm[2], url });
    }
    levels.set(level, notes);
  }
  const top = levels.get('top');
  const middle = levels.get('middle');
  const base = levels.get('base');
  if (top || middle || base) {
    return { type: 'full', topNotes: top ?? [], middleNotes: middle ?? [], baseNotes: base ?? [] };
  }
  const ingredients = levels.get('ingredients');
  if (ingredients && ingredients.length > 0) {
    // Schéma Apify : type single = allNotes + 3 tableaux vides
    return { type: 'single', topNotes: [], middleNotes: [], baseNotes: [], allNotes: ingredients };
  }
  return null;
}

function extractPerfumers(html: string): string[] {
  const out = new Set<string>();
  const re = /<a href="\/noses\/[^"]+"[\s\S]*?<span[^>]*>\s*([\s\S]*?)\s*<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = collapseWs(decodeEntities(stripTags(m[1])));
    if (name) out.add(name);
  }
  return [...out];
}

function extractRating(html: string): { perfumeRating: number | null; ratingCount: number | null } {
  const rv = /itemprop="ratingValue"[^>]*>\s*([\d.]+)\s*</.exec(html);
  const rc = /itemprop="ratingCount" content="(\d+)"/.exec(html);
  return {
    perfumeRating: rv ? parseFloat(rv[1]) : null,
    ratingCount: rc ? parseInt(rc[1], 10) : null,
  };
}

function extractReviewCount(html: string): number | null {
  // « Reviews (189) » ou format compact « Reviews (4.2K) »
  const m = /Reviews \((?:<span[^>]*>)?\s*([\d.,]+)([KM])?/.exec(html);
  if (!m) return null;
  const base = parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(base)) return null;
  const mult = m[2] === 'K' ? 1000 : m[2] === 'M' ? 1_000_000 : 1;
  return Math.round(base * mult);
}

function extractCanonical(html: string, fallback: string): string {
  const m = /<link rel="canonical" href="([^"]+)"/.exec(html);
  return m ? m[1] : fallback;
}

// ---------------------------------------------------------------------------
// Mapping du payload `status` déchiffré → champs Apify
// ---------------------------------------------------------------------------

function breakout(obj: Record<string, number> | undefined, labels: string[]): Record<string, number>[] {
  if (!obj) return [];
  return labels.map((label, i) => ({ [label]: obj[String(i + 1)] ?? 0 }) as Record<string, number>);
}

function weightedAvg(obj: Record<string, number> | undefined): number | null {
  if (!obj) return null;
  let sum = 0;
  let total = 0;
  for (const [k, v] of Object.entries(obj)) {
    sum += Number(k) * v;
    total += v;
  }
  if (total === 0) return null;
  return Math.round((sum / total) * 10000) / 10000;
}

function mapStatus(s: StatusData['status']): Partial<RawEntry> {
  const gender = s.gender;
  return {
    longevityBreakout: breakout(s.longevity, LONGEVITY_LABELS),
    longevityAverage: weightedAvg(s.longevity),
    longevitySum: s.longevity_sum ?? null,
    longevityMax: s.longevity_max ?? null,
    sillageBreakout: breakout(s.sillage, SILLAGE_LABELS),
    sillageAverage: weightedAvg(s.sillage),
    sillageSum: s.sillage_sum ?? null,
    sillageMax: s.sillage_max ?? null,
    priceValueBreakout: breakout(s.price_value, PRICE_VALUE_LABELS),
    priceValueAverage: weightedAvg(s.price_value),
    priceValueSum: s.price_value_sum ?? null,
    priceValueMax: s.price_value_max ?? null,
    ratingBreakout: breakout(s.rating, RATING_LABELS),
    ratingAverage: weightedAvg(s.rating),
    ratingSum: s.rating_sum ?? null,
    ratingMax: s.rating_max ?? null,
    ratingCount: s.people ?? s.rating_sum ?? null,
    genderBreakout: gender
      ? {
          female: gender.female ?? 0,
          femaleUnisex: gender.female_unisex ?? 0,
          unisex: gender.unisex ?? 0,
          male: gender.male ?? 0,
          maleUnisex: gender.male_unisex ?? 0,
        }
      : null,
    genderSum: s.gender_sum ?? null,
    genderMax: s.gender_max ?? null,
    seasonBreakout: {
      winter: s.winter ?? 0,
      spring: s.spring ?? 0,
      summer: s.summer ?? 0,
      autumn: s.autumn ?? 0,
      day: s.day ?? 0,
      night: s.night ?? 0,
    },
    relationBreakout: s.relation
      ? { have: s.relation.have ?? 0, had: s.relation.had ?? 0, want: s.relation.want ?? 0 }
      : null,
    relationSum: s.relation_sum ?? null,
    relationMax: s.relation_max ?? null,
  };
}

// ---------------------------------------------------------------------------
// Parse d'une fiche complète
// ---------------------------------------------------------------------------

async function parsePerfumePage(html: string, job: PerfumeJob): Promise<RawEntry> {
  const id = job.fragranticaId;

  // H1 = "<nom> <marque>" (+ span "for men|for women|for women and men")
  const h1 = extractH1(html);
  if (!h1 || !h1.h1Text) throw new Error('H1 introuvable');

  // Marque : description « by <b>Marque</b> » > hint > segment d'URL
  const urlBrandSlug = /\/perfume\/([^/]+)\//.exec(job.url)?.[1] ?? '';
  const descM = /<b>[\s\S]*?<\/b>\s*by\s*<b>([^<]+)<\/b>/.exec(html);
  const brandName = descM
    ? decodeEntities(descM[1]).trim()
    : (job.brandNameHint ?? urlBrandSlug.replace(/-/g, ' '));

  // Le <title> SEO de Fragrantica injecte un mot-clé de concentration générique
  // (« cologne » pour les hommes, « perfume » pour les femmes) qui ne reflète PAS
  // le flacon réel. On ne l'utilise donc plus : la concentration officielle vit dans
  // le nom (h1) et est dérivée par parseTitle / l'app via concentrationFromName.
  const titleTag = extractTitleTag(html);

  // Année : fin du <title>, sinon « launched in YYYY » dans la description
  let year: number | null = null;
  const yearM = /(\d{4})\s*$/.exec(titleTag);
  if (yearM) {
    year = parseInt(yearM[1], 10);
  } else {
    const launchM = /launched in (\d{4})/.exec(html);
    if (launchM) year = parseInt(launchM[1], 10);
  }

  // Titre reconstruit au format Apify : « <nom> <marque> <type> - a fragrance for ... <année> »
  const title = `${h1.h1Text} - a fragrance ${h1.genderText || 'for women and men'}${year ? ` ${year}` : ''}`;

  const gender = h1.genderText.includes('women and men') ? 'unisex' : h1.genderText.includes('women') ? 'female' : h1.genderText.includes('men') ? 'male' : null;

  // Votes (payload chiffré)
  let statusFields: Partial<RawEntry> = {};
  const statusM = /let status = (\{[^;]+\});/.exec(html);
  if (statusM) {
    try {
      const payload = JSON.parse(statusM[1]) as EncryptedPayload;
      const data = await decryptPayload<StatusData>(payload);
      statusFields = mapStatus(data.status);
    } catch (err) {
      console.warn(`    ⚠️  déchiffrement status : ${(err as Error).message}`);
    }
  } else {
    console.warn('    ⚠️  payload status absent de la page');
  }

  const { perfumeRating, ratingCount } = extractRating(html);

  return {
    id,
    url: extractCanonical(html, job.url),
    title,
    description: extractDescription(html),
    primaryImageUrl: `https://fimgs.net/mdimg/perfume-thumbs/375x500.${id}.jpg`,
    images: [`https://fimgs.net/mdimg/perfume-social-cards/en-p_c_${id}.jpeg`],
    brandName,
    brandUrl: `${FRAGRANTICA_BASE}/designers/${urlBrandSlug}.html`,
    brandLogo: null,
    mainAccords: extractAccords(html),
    pros: [],
    cons: [],
    pyramid: extractPyramid(html),
    longevityBreakout: [],
    longevityAverage: null,
    longevitySum: null,
    longevityMax: null,
    sillageBreakout: [],
    sillageAverage: null,
    sillageSum: null,
    sillageMax: null,
    priceValueBreakout: [],
    priceValueAverage: null,
    priceValueSum: null,
    priceValueMax: null,
    perfumeRating,
    ratingBreakout: [],
    ratingAverage: null,
    ratingSum: null,
    ratingMax: null,
    bestRating: 5,
    ratingCount: statusFields.ratingCount ?? ratingCount,
    reviewCount: extractReviewCount(html),
    gender,
    genderBreakout: null,
    genderSum: null,
    genderMax: null,
    thisPerfumeRemindsMeOf: [],
    seasonBreakout: null,
    relationBreakout: null,
    relationSum: null,
    relationMax: null,
    perfumers: extractPerfumers(html),
    peopleWhoLikeThisAlsoLike: [],
    reviews: [],
    ...statusFields,
  };
}

// ---------------------------------------------------------------------------
// Construction de la liste des jobs
// ---------------------------------------------------------------------------

interface QueueBrandNew {
  nom: string;
  url: string;
  fragranticaId: string;
}

interface QueueFileLite {
  brands: { name: string; new: QueueBrandNew[] }[];
}

function latestQueueFile(): string | null {
  if (!fs.existsSync(WATCH_DIR)) return null;
  const files = fs.readdirSync(WATCH_DIR).filter((f) => f.startsWith('queue-') && f.endsWith('.json')).sort();
  return files.length > 0 ? path.join(WATCH_DIR, files[files.length - 1]) : null;
}

async function buildJobs(): Promise<PerfumeJob[]> {
  const urlsArg = argValue('urls');
  if (urlsArg) {
    return urlsArg.split(',').map((u) => {
      const url = u.trim().startsWith('http') ? u.trim() : `${FRAGRANTICA_BASE}${u.trim()}`;
      const id = /-(\d+)\.html/.exec(url)?.[1] ?? '';
      return { url, fragranticaId: id };
    });
  }

  const brandsArg = argValue('brands');
  if (brandsArg) {
    const jobs: PerfumeJob[] = [];
    for (const slug of brandsArg.split(',').map((s) => s.trim()).filter(Boolean)) {
      console.log(`📄 page de marque ${slug}…`);
      const html = await fetchFragrantica(`${FRAGRANTICA_BASE}/designers/${slug}.html`);
      const cards = parseBrandPerfumeCards(html, slug.replace(/-/g, ' '));
      for (const c of cards) {
        jobs.push({ url: `${FRAGRANTICA_BASE}${c.url}`, fragranticaId: c.fragranticaId, brandNameHint: c.designer });
      }
      console.log(`   ${cards.length} fiches trouvées\n`);
      await sleepJitter(400);
    }
    return jobs;
  }

  const queueFile = argValue('queue') ?? latestQueueFile();
  if (!queueFile || !fs.existsSync(queueFile)) {
    console.error(`❌ Aucune file trouvée — lance d'abord : npm run diff-brands (ou utilise --brands= / --urls=)`);
    process.exit(1);
  }
  console.log(`File : ${queueFile}\n`);
  const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8')) as QueueFileLite;
  const jobs: PerfumeJob[] = [];
  for (const brand of queue.brands) {
    for (const p of brand.new) {
      jobs.push({ url: `${FRAGRANTICA_BASE}${p.url}`, fragranticaId: p.fragranticaId, brandNameHint: brand.name });
    }
  }
  return jobs;
}

// ---------------------------------------------------------------------------
// Progress + écriture data/raw
// ---------------------------------------------------------------------------

interface Progress {
  done: string[];
}

function loadProgress(): Progress {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) as Progress;
  } catch {
    return { done: [] };
  }
}

function saveProgress(p: Progress): void {
  fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p), 'utf8');
}

function brandFileKey(brandName: string): string {
  return brandName.replace(/[^A-Za-z0-9]/g, '');
}

function mergeIntoRawFile(outDir: string, entry: RawEntry): { file: string; isNew: boolean } {
  const key = brandFileKey(entry.brandName);
  const file = path.join(outDir, `${key}.json`);
  let entries: RawEntry[] = [];
  if (fs.existsSync(file)) {
    try {
      entries = JSON.parse(fs.readFileSync(file, 'utf8')) as RawEntry[];
    } catch {
      entries = [];
    }
  }
  const idx = entries.findIndex((e) => String(e.id) === entry.id);
  const isNew = idx === -1;
  if (isNew) {
    entries.push(entry);
  } else {
    entries[idx] = entry;
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  return { file, isNew };
}

// ---------------------------------------------------------------------------
// Mode v2 : écriture directe data/clean (saute l'étape clean-data)
// ---------------------------------------------------------------------------

// Réplique exacte de la transformation cleanEntry de clean-apify.ts :
// strip des champs traçants + champs *Sum/*Max, notes réduites à {name}.
const CLEAN_STRIP_FIELDS = new Set([
  'id', 'url', 'brandUrl', 'brandLogo', 'description', 'pros', 'cons',
  'thisPerfumeRemindsMeOf', 'peopleWhoLikeThisAlsoLike', 'reviews', 'images',
]);
const CLEAN_SUM_MAX_PATTERNS = ['Sum', 'Max'];

function stripNotes(notes: RawNote[] | undefined): { name: string }[] {
  if (!Array.isArray(notes)) return [];
  return notes.map((n) => ({ name: n.name }));
}

function toCleanEntry(entry: RawEntry): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entry)) {
    if (CLEAN_STRIP_FIELDS.has(k)) continue;
    if (CLEAN_SUM_MAX_PATTERNS.some((p) => k.endsWith(p))) continue;
    out[k] = v;
  }
  const pyramid = out.pyramid as RawPyramid | null | undefined;
  if (pyramid) {
    pyramid.topNotes = stripNotes(pyramid.topNotes);
    pyramid.middleNotes = stripNotes(pyramid.middleNotes);
    pyramid.baseNotes = stripNotes(pyramid.baseNotes);
    if (pyramid.allNotes !== undefined) pyramid.allNotes = stripNotes(pyramid.allNotes);
  }
  return out;
}

// Merge par id CALCULÉE (les entrées clean n'ont pas d'id — même formule
// normaliseId(marque_nom) qu'import-fresh, via parseTitle partagé).
function mergeIntoCleanFile(cleanDir: string, entry: RawEntry): { file: string; isNew: boolean } {
  const key = brandFileKey(entry.brandName);
  const file = path.join(cleanDir, `${key}.json`);
  const cleanEntry = toCleanEntry(entry);
  const entryId = parfumIdFromTitle(entry.title, entry.brandName);

  let entries: Record<string, unknown>[] = [];
  if (fs.existsSync(file)) {
    try {
      entries = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>[];
    } catch {
      entries = [];
    }
  }
  const idx = entries.findIndex(
    (e) => parfumIdFromTitle(String(e.title ?? ''), String(e.brandName ?? '')) === entryId,
  );
  const isNew = idx === -1;
  if (isNew) entries.push(cleanEntry);
  else entries[idx] = cleanEntry;
  fs.mkdirSync(cleanDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  return { file, isNew };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // --format=raw (défaut, chaîne historique) | clean (v2, saute clean-data) | both
  const formatArg = (argValue('format') ?? 'raw').toLowerCase();
  if (formatArg !== 'raw' && formatArg !== 'clean' && formatArg !== 'both') {
    console.error(`❌ --format=${formatArg} invalide (attendu : raw | clean | both)`);
    process.exit(1);
  }
  const format = formatArg;
  const outDirArg = argValue('out-dir');
  if (format === 'both' && outDirArg) {
    console.warn('⚠️  --out-dir ignoré en mode both (utilise data/raw + data/clean)');
  }
  const rawDir = path.resolve(format === 'both' ? path.join('data', 'raw') : (outDirArg ?? path.join('data', 'raw')));
  const cleanDir = path.resolve(format === 'both' ? path.join('data', 'clean') : (outDirArg ?? path.join('data', 'clean')));
  const limit = argValue('limit') ? parseInt(argValue('limit')!, 10) : null;
  const delay = argValue('delay') ? parseInt(argValue('delay')!, 10) : 400;
  const refresh = hasFlag('refresh');
  const dryRun = hasFlag('dry-run');

  let jobs = await buildJobs();
  if (jobs.length === 0) {
    console.log('Aucune fiche à scraper.');
    return;
  }

  const progress = refresh ? { done: [] } : loadProgress();
  const doneSet = new Set(progress.done);
  const before = jobs.length;
  jobs = jobs.filter((j) => !doneSet.has(j.fragranticaId));
  if (before !== jobs.length) console.log(`${before - jobs.length} déjà faites (checkpoint), ${jobs.length} restantes.`);
  if (limit !== null) jobs = jobs.slice(0, limit);

  console.log(`${jobs.length} fiches à scraper (délai ${delay} ms)${dryRun ? ' — DRY RUN' : ''}\n`);

  let ok = 0;
  let createdRaw = 0;
  let updatedRaw = 0;
  let createdClean = 0;
  let updatedClean = 0;
  const failed: { url: string; reason: string }[] = [];
  const touchedFiles = new Set<string>();

  for (const [i, job] of jobs.entries()) {
    const label = `[${String(i + 1).padStart(3)}/${jobs.length}]`;
    try {
      const html = await fetchFragrantica(job.url);
      const entry = await parsePerfumePage(html, job);
      if (entry.title.includes('�')) {
        failed.push({ url: job.url, reason: 'titre contient U+FFFD (encodage cassé)' });
        console.warn(`${label} ✗ ${entry.title} — U+FFFD ignoré`);
        await sleepJitter(delay);
        continue;
      }
      if (dryRun) {
        console.log(`${label} ✓ ${entry.title} (${entry.mainAccords.length} accords, pyramide ${entry.pyramid?.type ?? 'none'})`);
        ok++;
      } else {
        const tags: string[] = [];
        if (format !== 'clean') {
          const { file, isNew } = mergeIntoRawFile(rawDir, entry);
          touchedFiles.add(file);
          if (isNew) createdRaw++;
          else updatedRaw++;
          tags.push(`raw ${isNew ? 'nouveau' : 'maj'}`);
        }
        if (format !== 'raw') {
          const { file, isNew } = mergeIntoCleanFile(cleanDir, entry);
          touchedFiles.add(file);
          if (isNew) createdClean++;
          else updatedClean++;
          tags.push(`clean ${isNew ? 'nouveau' : 'maj'}`);
        }
        progress.done.push(job.fragranticaId);
        if (ok % 10 === 0) saveProgress(progress);
        ok++;
        console.log(`${label} ✓ ${entry.title} (${tags.join(' + ')})`);
      }
    } catch (err) {
      const reason = (err as Error).message.split('\n')[0];
      failed.push({ url: job.url, reason });
      console.warn(`${label} ✗ ${job.url} — ${reason}`);
    }
    if (i < jobs.length - 1) await sleepJitter(delay);
  }

  if (!dryRun) saveProgress(progress);

  console.log(`\n✅ ${ok}/${jobs.length} fiches scrapées`);
  if (format !== 'clean') console.log(`   data/raw   : ${createdRaw} nouvelles entrées, ${updatedRaw} mises à jour`);
  if (format !== 'raw') console.log(`   data/clean : ${createdClean} nouvelles entrées, ${updatedClean} mises à jour`);
  if (failed.length > 0) {
    console.log(`❌ ${failed.length} échecs :`);
    for (const f of failed) console.log(`   - ${f.url} : ${f.reason}`);
  }
  if (touchedFiles.size > 0) {
    console.log(`\nFichiers touchés :`);
    for (const f of touchedFiles) console.log(`   → ${f}`);
    if (format === 'raw') {
      console.log(`\nÉtape suivante : npm run clean-data, puis npm run import-fresh -- --target=cloud`);
    } else if (format === 'clean') {
      console.log(`\nÉtape suivante : npm run import-fresh -- --target=cloud`);
      console.log(`⚠️  NE PAS relancer npm run clean-data : les entrées écrites directement dans data/clean seraient perdues (non présentes dans data/raw).`);
    } else {
      console.log(`\nÉtape suivante : npm run import-fresh -- --target=cloud (clean déjà à jour)`);
    }
  }
}

main().catch((err) => {
  console.error('❌ Échec du scraping :', err);
  process.exit(1);
});
