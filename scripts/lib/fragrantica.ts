import { execFile } from 'child_process';
import { promisify } from 'util';
import { readEnvVar } from './script-utils';

/**
 * Helpers partagés pour le scraping Fragrantica (pipeline data).
 *
 * Le WAF Fragrantica bloque les clients Node (fetch/https → 403, fingerprint
 * TLS non-browser). curl (Schannel Windows) passe avec de simples headers
 * navigateur → tous les scripts shell-out vers curl.exe (préinstallé Win10+).
 *
 * Proxy optionnel : `SCRAPER_PROXY` dans .env (format http://[user:pass@]host:port).
 * Avec un proxy résidentiel rotatif (Webshare, Smartproxy, Bright Data…),
 * un seul endpoint suffit — la rotation est gérée côté fournisseur.
 */

const execFileAsync = promisify(execFile);

export const FRAGRANTICA_BASE = 'https://www.fragrantica.com';

const CURL_BIN = process.platform === 'win32' ? 'curl.exe' : 'curl';
const TIMEOUT_S = 30;

const HEADERS = [
  '-H',
  'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  '-H',
  'Accept: text/html,application/xhtml+xml',
  '-H',
  'Accept-Language: en-US,en;q=0.9',
];

const PROXY_URL = readEnvVar('SCRAPER_PROXY');
const PROXY_SAFE = PROXY_URL ? PROXY_URL.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@') : '';
let proxyLogged = false;

function logProxyOnce(): void {
  if (!PROXY_URL || proxyLogged) return;
  proxyLogged = true;
  console.log(`  🛡️  proxy actif : ${PROXY_SAFE}`);
}

/** GET d'une page Fragrantica via curl, 3 tentatives avec backoff. */
export async function fetchFragrantica(url: string, attempt = 1): Promise<string> {
  logProxyOnce();
  try {
    const { stdout } = await execFileAsync(
      CURL_BIN,
      ['-sS', '-L', '--fail', '--compressed', '-m', String(TIMEOUT_S), ...HEADERS, ...(PROXY_URL ? ['--proxy', PROXY_URL] : []), url],
      // Pages jusqu'à ~2 MB → buffer large (défaut maxBuffer = 1 MB, insuffisant)
      { maxBuffer: 32 * 1024 * 1024, encoding: 'utf-8' },
    );
    return stdout;
  } catch (err) {
    // Ne jamais laisser les credentials du proxy dans les messages d'erreur
    const rawMsg = (err as Error).message.split('\n')[0];
    const message = PROXY_URL ? rawMsg.split(PROXY_URL).join(PROXY_SAFE) : rawMsg;
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('curl introuvable — installer curl ou utiliser une machine Windows 10+');
    }
    if (attempt < 3) {
      const wait = attempt * 1000;
      console.warn(`  ⚠️  ${url} : ${message} — retry dans ${wait}ms`);
      await sleep(wait);
      return fetchFragrantica(url, attempt + 1);
    }
    throw err;
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ccedil: 'ç',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

export function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

/** Même formule que import-fresh.ts — id BDD d'un parfum = normaliseId(marque_nom). */
export function normaliseId(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** normaliseTexte d'import-fresh.ts — comparaison de marques insensible casse/accents. */
export function normaliseTexte(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** sleep avec jitter ±~35 % — un délai fixe est une signature détectable. */
export function sleepJitter(ms: number): Promise<void> {
  return sleep(Math.round(ms * (0.75 + Math.random() * 0.75)));
}

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Parsing des cartes parfum d'une page de marque
// ---------------------------------------------------------------------------

export interface BrandPerfumeCard {
  nom: string;
  year: number | null;
  url: string;
  fragranticaId: string;
  designer: string;
}

// Carte parfum : <a href="/perfume/<marque>/<parfum>-<id>.html" rel="noopener noreferrer" ...>
//   <h3 class="tw-grid-perfume-title">Nom</h3> <p class="tw-grid-perfume-designer">Marque</p>
//   <span class="tw-grid-year-text">1985</span> </a>
const CARD_RE = /<a href="(\/perfume\/[^"]+?-(\d+)\.html)" rel="noopener noreferrer"[\s\S]*?<\/a>/g;
const CARD_TITLE_RE = /<h3 class="tw-grid-perfume-title">\s*([\s\S]*?)\s*<\/h3>/;
const CARD_DESIGNER_RE = /<p class="tw-grid-perfume-designer">\s*([\s\S]*?)\s*<\/p>/;
const CARD_YEAR_RE = /<span class="tw-grid-year-text">\s*(\d{4})\s*<\/span>/;

/** Extrait les parfums listés sur une page de marque (grille « All Fragrances »). */
export function parseBrandPerfumeCards(html: string, fallbackDesigner: string): BrandPerfumeCard[] {
  const byUrl = new Map<string, BrandPerfumeCard>();
  let m: RegExpExecArray | null;
  CARD_RE.lastIndex = 0;
  while ((m = CARD_RE.exec(html)) !== null) {
    const [block, url, fragranticaId] = m;
    const titleM = CARD_TITLE_RE.exec(block);
    if (!titleM) continue;
    const nom = decodeEntities(stripTags(titleM[1])).trim();
    if (!nom) continue;
    const designerM = CARD_DESIGNER_RE.exec(block);
    const designer = designerM ? decodeEntities(stripTags(designerM[1])).trim() : fallbackDesigner;
    const yearM = CARD_YEAR_RE.exec(block);
    const year = yearM ? parseInt(yearM[1], 10) : null;
    if (!byUrl.has(url)) {
      byUrl.set(url, { nom, year, url, fragranticaId, designer });
    }
  }
  return [...byUrl.values()];
}
