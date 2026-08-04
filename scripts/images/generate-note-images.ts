/**
 * Génère des images de notes olfactives via DashScope Wanx (Alibaba Cloud).
 *
 * Prérequis:
 *   1. Aller sur https://dashscope.console.aliyun.com/apiKey
 *   2. Créer une clé API (commence par sk-)
 *   3. Ajouter dans .env : DASHSCOPE_API_KEY=sk-xxxxxxxx
 *
 * Usage:
 *   npm run generate-notes             Génère toutes les notes manquantes
 *   npm run generate-notes -- --list   Liste les notes à générer (sans générer)
 *
 * Les images sont sauvées dans data/note-images/{note}.webp (256×256).
 * Le script est reprenable : les notes déjà générées sont sautées.
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// .env minimal (pas de dépendance dotenv)
// ---------------------------------------------------------------------------

function loadEnv(): void {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_KEY = process.env.DASHSCOPE_API_KEY;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OUT_DIR = path.resolve('data/note-images');
// wan2.2-t2i-plus = meilleure qualité ; wan2.2-t2i-flash = ~10× moins cher + plus rapide
// (suffisant pour des vignettes 28 px). Override via DASHSCOPE_MODEL dans .env.
const MODEL = (process.env.DASHSCOPE_MODEL || 'wan2.2-t2i-plus').trim();
const GEN_SIZE = 512;
const OUT_SIZE = 256;
const DELAY_MS = 2500;
const POLL_MS = 2000;
const MAX_POLLS = 90;

// Les clés sk-ws- sont liées à un workspace → l'endpoint DOIT contenir le Workspace ID.
// Région Singapore (défaut) : host = ap-southeast-1.maas.aliyuncs.com
// Région Francfort         : host = eu-central-1.maas.aliyuncs.com  (DASHSCOPE_REGION_HOST)
// Override complet possible via DASHSCOPE_BASE_URL.
const WORKSPACE_ID = (process.env.DASHSCOPE_WORKSPACE_ID || '').trim();
const REGION_HOST = (
  process.env.DASHSCOPE_REGION_HOST || 'ap-southeast-1.maas.aliyuncs.com'
).trim();
const API_BASE =
  process.env.DASHSCOPE_BASE_URL ||
  (WORKSPACE_ID ? `https://${WORKSPACE_ID}.${REGION_HOST}/api/v1` : '');

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

// Notes liquides/visqueuses → le modèle les met sinon en flacon étiqueté.
// On demande une goutte / coulée sans contenant.
const LIQUID_NOTES = new Set<string>([
  'Honey', 'White Honey', 'Caramel', 'Toffee', 'Burnt Sugar', 'Custard',
  'Cognac', 'Rum', 'Whiskey', 'Bourbon Whiskey', 'Brandy', 'Madeira', 'Espresso',
]);

function isLiquid(note: string): boolean {
  return LIQUID_NOTES.has(note);
}

function buildPrompt(note: string): string {
  if (isLiquid(note)) {
    return (
      `studio macro photograph of a glossy drop and small ripple of ${note}, ` +
      'rich saturated color, on a seamless pure white background, soft shadow, ' +
      'no bottle, no glass, no cup, no jar, no container, no label, no text, ' +
      'sharp focus, high detail, square composition'
    );
  }
  return (
    `studio macro photograph of the raw ${note} ingredient itself, ` +
    'single item centered on a seamless pure white background, ' +
    'soft even lighting, sharp focus, high detail, square composition, ' +
    'no bottle, no box, no packaging, no label, no text'
  );
}

const NEGATIVE_PROMPT =
  'text, letters, words, writing, label, logo, branding, watermark, ' +
  'bottle, box, packaging, container, jar, tin, can, glass, cup, ' +
  'multiple objects, hands, person, blurry, illustration, painting, cartoon, low quality';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Curation : exclusion des notes non-photographiables + dédoublonnage
// ---------------------------------------------------------------------------

// Accords / familles abstraits (jamais photographiables)
function isAbstract(note: string): boolean {
  return /\snotes$/i.test(note) || /\saccord$/i.test(note) || /^exotic\s/i.test(note);
}

// Molécules de synthèse, concepts abstraits, marques, matières non-visuelles.
// (Les notes finissant par " notes" / " accord" sont gérées par isAbstract.)
const NON_VISUAL = new Set<string>([
  'Akigalawood', 'Aldehydes', 'Ambrettolide', 'Ambrofix™', 'Ambronova ™',
  'Ambroxan', 'Ambrarome', 'Ambreine', 'Calone', 'Calypsone', 'Cashalox',
  'Cashmeran', 'Cashmirwood', 'Coumarin', 'Georgywood', 'Geosmin', 'Hedione',
  'Hexyl acetate', 'Iso E Super', 'Karo Karounde', 'Lysylang', 'Mugane',
  'Muscone', 'Orcanox™', 'Petalia', 'Pomarose', 'Pepperwood™', 'Timberol',
  'Vinyl Guaiacol',
  'Musk', 'White Musk', 'Natural Musk', 'White Amber', 'Black Amber', 'Light Amber',
  'Gold', 'Silver', 'Ink', 'Skin', 'Smoke', 'Soap', 'Silk',
  'Precious Woods', 'White Woods', 'Exotic Spices',
  'Soil Tincture', 'Tincture of Rose',
  'Coca-Cola', 'Almdudler', 'Opium',
  // Blancs / translucides : invisibles en chip sur fond blanc
  'Milk', 'Coconut Milk', 'Milk Mousse', 'Whipped Cream', 'Fresh Cream',
  'Chantilly Cream', 'Coconut Water', 'Milkshake', 'Gin', 'Tonic Water',
]);

function isExcluded(note: string): boolean {
  return NON_VISUAL.has(note) || isAbstract(note);
}

// Traductions, typos et variantes géographiques → canonical anglais
const ALIAS: Record<string, string> = {
  Vanille: 'Vanilla', Vanila: 'Vanilla',
  Vetyver: 'Vetiver', 'Haitian Vetiver': 'Vetiver', 'Tahitian Vetiver': 'Vetiver', 'Java vetiver oil': 'Vetiver',
  'Ylang-Ylang': 'Ylang Ylang',
  Cinammon: 'Cinnamon', 'Ceylon Cinnamon': 'Cinnamon', 'Chinese Cinnamon Wood': 'Cinnamon',
  'Virginia Cedar': 'Cedar', 'Virginian Cedar': 'Cedar', Cedarwood: 'Cedar', 'Atlas Cedar': 'Cedar', 'Texas Cedar': 'Cedar', 'White Cedar Extract': 'Cedar', 'Red Cedar': 'Cedar',
  'Lily-of-the-Valley': 'Lily of the Valley',
  Rhuburb: 'Rhubarb', Myrhh: 'Myrrh', Hiacynth: 'Hyacinth', Cardamon: 'Cardamom',
  'juniper berry': 'Juniper Berries', 'black fig': 'Fig',
  elemi: 'Elemi resin', 'oak moss': 'Oakmoss', 'Coton candy': 'Cotton candy',
  Nagarmotha: 'Cypriol', 'Cypriol Oil': 'Cypriol', 'Cypriol Oil or Nagarmotha': 'Cypriol',
  'Bulgarian Rose': 'Rose', 'Damask Rose': 'Rose', 'French Rose': 'Rose', 'Grasse Rose': 'Rose', 'May Rose': 'Rose', 'Taif Rose': 'Rose', 'Turkish Rose': 'Rose', 'Hamanasu or Japanese Rose': 'Rose',
  'Chinese Jasmine': 'Jasmine', 'Egyptian Jasmine': 'Jasmine', 'Indian Jasmine': 'Jasmine', 'Indonesian Jasmine': 'Jasmine', 'Moroccan Jasmine': 'Jasmine', 'Jasmine Sambac': 'Jasmine', 'Jasmine Orchid': 'Jasmine', 'Night Blooming Jasmine': 'Jasmine', 'False Jasmine': 'Jasmine',
};

function resolve(note: string): string | null {
  if (isExcluded(note)) return null;
  const canonical = ALIAS[note] ?? note;
  return isExcluded(canonical) ? null : canonical;
}

// ---------------------------------------------------------------------------
// DashScope Wanx API (async task)
// ---------------------------------------------------------------------------

async function submitTask(note: string): Promise<string> {
  const res = await fetch(`${API_BASE}/services/aigc/text2image/image-synthesis`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify({
      model: MODEL,
      input: { prompt: buildPrompt(note), negative_prompt: NEGATIVE_PROMPT },
      parameters: { size: `${GEN_SIZE}*${GEN_SIZE}`, n: 1, prompt_extend: false },
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  const output = data.output as Record<string, unknown> | undefined;
  const taskId = output?.task_id as string | undefined;

  if (!taskId) {
    throw new Error(`Submit échoué: ${JSON.stringify(data)}`);
  }
  return taskId;
}

async function waitForResult(taskId: string): Promise<string> {
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_MS);

    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const data = (await res.json()) as Record<string, unknown>;
    const output = data.output as Record<string, unknown> | undefined;
    const status = output?.task_status as string | undefined;

    if (status === 'SUCCEEDED') {
      const results = output?.results as Array<{ url?: string }> | undefined;
      const url = results?.[0]?.url;
      if (!url) throw new Error('Pas d\'URL dans le résultat');
      return url;
    }

    if (status === 'FAILED' || status === 'UNKNOWN') {
      throw new Error(`Tâche ${status}: ${JSON.stringify(data)}`);
    }
  }
  throw new Error('Timeout — la tâche n\'a pas abouti');
}

async function generateImage(note: string): Promise<Buffer> {
  const taskId = await submitTask(note);
  const url = await waitForResult(taskId);
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Download échoué: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Récupération des notes uniques depuis Supabase
// ---------------------------------------------------------------------------

async function fetchUniqueNotes(): Promise<string[]> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  // Paginé : sans .range(), PostgREST tronque silencieusement à db-max-rows.
  // .order('id') requis — sans ORDER BY la pagination est instable.
  const CHUNK = 1000;
  const noteSet = new Set<string>();
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase
      .from('parfums')
      .select('notes_tete, notes_coeur, notes_fond')
      .order('id')
      .range(from, from + CHUNK - 1);

    if (error) throw new Error(`Supabase: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const p of data) {
      for (const arr of [p.notes_tete, p.notes_coeur, p.notes_fond]) {
        if (!Array.isArray(arr)) continue;
        for (const n of arr) {
          const trimmed = (n as string).trim();
          if (trimmed) noteSet.add(trimmed);
        }
      }
    }
    if (data.length < CHUNK) break;
  }

  return [...noteSet].sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!API_KEY) {
    console.error('');
    console.error('  DASHSCOPE_API_KEY manquant dans .env');
    console.error('');
    console.error('  1. Aller sur https://bailian.console.alibabacloud.com/?tab=model#/api-key');
    console.error('  2. Créer une clé API (région Singapore)');
    console.error('  3. Ajouter dans .env : DASHSCOPE_API_KEY=sk-xxxxxxxx');
    console.error('');
    process.exit(1);
  }

  if (!API_BASE) {
    console.error('');
    console.error('  DASHSCOPE_WORKSPACE_ID manquant dans .env');
    console.error('  (ta clé sk-ws- est liée à un workspace, son ID est requis)');
    console.error('');
    console.error('  Trouver l\'ID :');
    console.error('   1. https://modelstudio.console.alibabacloud.com/ (région Singapore)');
    console.error('   2. Cliquer l\'icône en haut à droite → copier le Workspace ID');
    console.error('   3. Ajouter dans .env : DASHSCOPE_WORKSPACE_ID=xxxxxxxxxx');
    console.error('');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('Récupération des notes depuis Supabase...');
  const allNotes = await fetchUniqueNotes();

  // --- Résolution canonical + exclusion + carte note→image -----------------
  const noteMap: Record<string, string | null> = {};
  const genCanonicals = new Set<string>();
  let excludedCount = 0;
  let aliasCount = 0;
  for (const note of allNotes) {
    const c = resolve(note);
    if (c === null) {
      noteMap[note] = null;
      excludedCount++;
    } else {
      noteMap[note] = slug(c);
      if (c !== note) aliasCount++;
      genCanonicals.add(c);
    }
  }

  const existing = new Set(
    fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.webp')).map((f) => f.replace('.webp', '')),
  );
  let todo = [...genCanonicals].filter((c) => !existing.has(slug(c)));

  // --only "Coffee,Honey"  → mode test (noms bruts, résolus en canonical)
  const onlyIdx = process.argv.indexOf('--only');
  if (onlyIdx !== -1 && process.argv[onlyIdx + 1]) {
    const seen = new Set<string>();
    todo = [];
    for (const raw of process.argv[onlyIdx + 1].split(',')) {
      const c = resolve(raw.trim());
      if (c === null) {
        console.log(`  (exclu, ignoré) ${raw.trim()}`);
        continue;
      }
      if (!seen.has(c)) {
        seen.add(c);
        todo.push(c);
      }
    }
  }

  // --limit N  → tronque la liste à N
  const limitIdx = process.argv.indexOf('--limit');
  if (limitIdx !== -1) {
    const n = parseInt(process.argv[limitIdx + 1], 10);
    if (!isNaN(n)) todo = todo.slice(0, n);
  }

  // Carte note→image (l'UI s'en servira telle quelle : slug ou null)
  fs.writeFileSync(
    path.join(OUT_DIR, '_note-map.json'),
    JSON.stringify(noteMap, null, 2) + '\n',
    'utf-8',
  );

  console.log(`Notes uniques        : ${allNotes.length}`);
  console.log(`Exclues (abstrait)   : ${excludedCount}`);
  console.log(`Alias fusionnés      : ${aliasCount}`);
  console.log(`Canonicals à générer : ${genCanonicals.size}`);
  console.log(`Déjà générées        : ${existing.size}`);
  console.log(`À générer maintenant : ${todo.length}`);
  console.log('');

  if (process.argv.includes('--list')) {
    for (const n of todo) console.log(`  ${n}`);
    return;
  }

  if (todo.length === 0) {
    console.log('Rien à générer.');
    return;
  }

  let ok = 0;
  let fail = 0;
  const failed: string[] = [];

  for (let i = 0; i < todo.length; i++) {
    const note = todo[i];
    const file = path.join(OUT_DIR, `${slug(note)}.webp`);
    process.stdout.write(`[${i + 1}/${todo.length}] ${note} ... `);

    try {
      const buf = await generateImage(note);
      await sharp(buf)
        .resize(OUT_SIZE, OUT_SIZE, { fit: 'cover' })
        .webp({ quality: 85 })
        .toFile(file);
      console.log('OK');
      ok++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`ECHEC — ${msg}`);
      failed.push(note);
      fail++;
    }

    if (i < todo.length - 1) await sleep(DELAY_MS);
  }

  console.log('');
  console.log(`Terminé : ${ok} OK, ${fail} échecs`);
  console.log(`Images  : ${OUT_DIR}`);
  console.log(`Carte   : ${path.join(OUT_DIR, '_note-map.json')}`);

  if (failed.length > 0) {
    console.log('');
    console.log('Notes en échec (relancer le script pour réessayer) :');
    for (const n of failed) console.log(`  ${n}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
