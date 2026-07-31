/**
 * Upload les images de notes olfactives vers Supabase Storage.
 *
 * Prérequis : avoir généré les images avec `npm run generate-notes`.
 *
 * Usage :
 *   npm run upload-notes
 *
 * Les images sont uploadées dans le bucket `parfum-images` sous `notes/{slug}.webp`.
 * Le script est idempotent (upsert) — relancer sans risque.
 * À la fin, copie data/note-images/_note-map.json → src/data/note-map.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// .env minimal
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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'parfum-images';
const PREFIX = 'notes';
const CONCURRENCY = 8;

const IMG_DIR = path.resolve('data/note-images');
const MAP_SRC = path.join(IMG_DIR, '_note-map.json');
const MAP_DEST = path.resolve('src/data/note-map.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function uploadOne(
  storage: ReturnType<typeof createClient>['storage'],
  filename: string,
): Promise<void> {
  const filePath = `${PREFIX}/${filename}`;
  const buf = fs.readFileSync(path.join(IMG_DIR, filename));
  const { error } = await storage.from(BUCKET).upload(filePath, buf, {
    contentType: 'image/webp',
    upsert: true,
  });
  if (error) throw error;
}

async function runBatch(
  storage: ReturnType<typeof createClient>['storage'],
  files: string[],
  start: number,
): Promise<{ ok: number; fail: number; errors: string[] }> {
  let ok = 0;
  let fail = 0;
  const errors: string[] = [];
  const batch = files.slice(start, start + CONCURRENCY);

  const results = await Promise.allSettled(
    batch.map((f) => uploadOne(storage, f)),
  );

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      ok++;
    } else {
      fail++;
      errors.push(`${batch[i]}: ${r.reason}`);
    }
  }

  return { ok, fail, errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('EXPO_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const files = fs
    .readdirSync(IMG_DIR)
    .filter((f) => f.endsWith('.webp'))
    .sort();

  console.log(`Images à uploader : ${files.length}`);
  console.log(`Bucket            : ${BUCKET}/${PREFIX}/`);
  console.log('');

  let totalOk = 0;
  let totalFail = 0;
  const allErrors: string[] = [];

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const { ok, fail, errors } = await runBatch(supabase.storage, files, i);
    totalOk += ok;
    totalFail += fail;
    allErrors.push(...errors);
    process.stdout.write(`  ${Math.min(i + CONCURRENCY, files.length)}/${files.length}\r`);
  }

  console.log('');
  console.log(`Upload terminé : ${totalOk} OK, ${totalFail} échecs`);

  if (allErrors.length > 0) {
    console.log('');
    console.log('Erreurs :');
    for (const e of allErrors) console.log(`  ${e}`);
  }

  if (fs.existsSync(MAP_SRC)) {
    fs.copyFileSync(MAP_SRC, MAP_DEST);
    console.log(`\nMap copiée → ${MAP_DEST}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
