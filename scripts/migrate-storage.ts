// scripts/migrate-storage.ts — Phase 1 migration Supabase (images)
// Migre les images parfum : Firebase Storage (24 412) + CDN Fragella (38)
// → bucket Supabase `parfum-images` (public), même arborescence parfums/{id}/primary.webp.
//
//   npm run migrate-storage                     # cible cloud, reprend au checkpoint
//   npm run migrate-storage -- --target=local   # cible locale (Docker, pour dev)
//   npm run migrate-storage -- --limit=50       # test sur 50 images
//   npm run migrate-storage -- --fresh          # ignore le checkpoint
//
// Reprenable : data/migration/storage-progress.json (done = skippés au re-run,
// failed = retentés automatiquement).

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SERVICE_ACCOUNT_PATH = path.resolve('service-account.json');
const INPUT_FILE = path.resolve('data', 'migration', 'parfums.ndjson');
const PROGRESS_FILE = path.resolve('data', 'migration', 'storage-progress.json');
const FAILED_FILE = path.resolve('data', 'migration', 'storage-failed.json');

const BUCKET = 'parfum-images';
const CONCURRENCY = 8;
const SAVE_EVERY = 200;

const LOCAL_URL = 'http://127.0.0.1:54321';
// NOTE : la clé service_role de l'instance LOCALE (`supabase start`) n'est PAS
// hardcodée ici (mauvaise pratique + faux positifs des scanners de secrets).
// Pour le mode --target=local, la mettre dans .env sous SUPABASE_LOCAL_SERVICE_ROLE
// (valeur affichée par `supabase status` / au démarrage de `supabase start`).

// ─── Types ───────────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  imageUrl: string;
}

interface Progress {
  done: string[];
  failed: { id: string; reason: string }[];
}

// ─── .env minimal ────────────────────────────────────────────────────────────

function readEnvVar(key: string): string | undefined {
  try {
    const content = fs.readFileSync(path.resolve('.env'), 'utf8');
    const m = content.match(new RegExp(`^${key}\\s*=\\s*(.+?)\\s*$`, 'm'));
    return m ? m[1] : undefined;
  } catch {
    return undefined;
  }
}

// ─── Progression ─────────────────────────────────────────────────────────────

function loadProgress(fresh: boolean): Progress {
  if (!fresh && fs.existsSync(PROGRESS_FILE)) {
    const p = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) as Progress;
    console.log(`Reprise : ${p.done.length} déjà migrées, ${p.failed.length} échecs précédents (retentés).`);
    return p;
  }
  return { done: [], failed: [] };
}

function saveProgress(p: Progress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p));
}

// ─── Lecture des candidats depuis le NDJSON ──────────────────────────────────

async function readCandidates(): Promise<Candidate[]> {
  const rl = readline.createInterface({
    input: fs.createReadStream(INPUT_FILE),
    crlfDelay: Infinity,
  });
  const out: Candidate[] = [];
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    const obj = JSON.parse(t) as { id?: string; imageUrl?: string };
    if (obj.id && obj.imageUrl) out.push({ id: obj.id, imageUrl: obj.imageUrl });
  }
  return out;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const local = args.includes('--target=local');
  const fresh = args.includes('--fresh');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) throw new Error('service-account.json introuvable.');
  if (!fs.existsSync(INPUT_FILE)) throw new Error('parfums.ndjson introuvable — lancer npm run export-firestore');

  // Firebase (source)
  if (getApps().length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sa = require(SERVICE_ACCOUNT_PATH);
    initializeApp({
      credential: cert(sa),
      storageBucket: `${sa.project_id}.firebasestorage.app`,
    });
  }
  const fbBucket = getStorage().bucket();

  // Supabase (cible)
  const supaUrl = local ? LOCAL_URL : readEnvVar('EXPO_PUBLIC_SUPABASE_URL');
  const supaKey = local ? readEnvVar('SUPABASE_LOCAL_SERVICE_ROLE') : readEnvVar('SUPABASE_SERVICE_ROLE_KEY');
  if (!supaUrl || !supaKey) {
    throw new Error(
      local
        ? 'Mode local : SUPABASE_LOCAL_SERVICE_ROLE manquant dans .env (voir `supabase status`).'
        : 'EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env',
    );
  }
  const supabase: SupabaseClient = createClient(supaUrl, supaKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Bucket public (idempotent)
  const { error: bucketError } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    console.warn(`⚠️  createBucket: ${bucketError.message} (on continue — il existe peut-être déjà)`);
  }

  // Candidats
  const all = await readCandidates();
  const progress = loadProgress(fresh);
  const doneSet = new Set(progress.done);
  let todo = all.filter((c) => !doneSet.has(c.id));
  if (limit !== null) todo = todo.slice(0, limit);

  console.log(`Cible      : ${local ? 'LOCALE' : 'CLOUD'} (${supaUrl})`);
  console.log(`Candidats  : ${all.length} images au total, ${todo.length} à traiter\n`);
  if (todo.length === 0) {
    console.log('✅ Rien à faire.');
    return;
  }

  const t0 = Date.now();
  let processed = 0;
  const failedNow: { id: string; reason: string }[] = [];

  const processOne = async (c: Candidate): Promise<void> => {
    const destPath = `parfums/${c.id}/primary.webp`;

    // 1. Télécharger (source : bucket Firebase OU CDN Fragella)
    let buffer: Buffer;
    if (c.imageUrl.includes('fragella.com')) {
      const res = await fetch(c.imageUrl);
      if (!res.ok) throw new Error(`CDN HTTP ${res.status}`);
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      const [buf] = await fbBucket.file(destPath).download();
      buffer = buf;
    }

    // 2. Uploader vers Supabase Storage
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(destPath, buffer, { contentType: 'image/webp', upsert: true });
    if (upErr) throw new Error(`upload: ${upErr.message}`);

    // 3. Mettre à jour image_url en base
    const publicUrl = `${supaUrl}/storage/v1/object/public/${BUCKET}/${destPath}`;
    const { error: dbErr } = await supabase.from('parfums').update({ image_url: publicUrl } as never).eq('id', c.id);
    if (dbErr) throw new Error(`update db: ${dbErr.message}`);

    progress.done.push(c.id);
  };

  // Pool de workers
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const idx = cursor++;
      if (idx >= todo.length) return;
      const c = todo[idx];
      try {
        await processOne(c);
      } catch (e: unknown) {
        failedNow.push({ id: c.id, reason: (e as Error)?.message ?? String(e) });
      }
      processed++;
      if (processed % SAVE_EVERY === 0) {
        saveProgress(progress);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        const rate = (processed / Math.max(1, (Date.now() - t0) / 1000)).toFixed(1);
        console.log(`  … ${processed}/${todo.length} (${rate}/s, ${failedNow.length} échecs, ${elapsed}s)`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  saveProgress(progress);
  fs.writeFileSync(FAILED_FILE, JSON.stringify(failedNow, null, 2));

  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\n——— Bilan ———`);
  console.log(`Traitées (ce run) : ${processed}`);
  console.log(`Réussies          : ${processed - failedNow.length}`);
  console.log(`Échecs            : ${failedNow.length} → ${FAILED_FILE}`);
  console.log(`Total migrées     : ${progress.done.length}/${all.length}`);
  console.log(`Durée             : ${elapsed}s`);
  console.log(`\n✅ Migration storage terminée.`);
}

main().catch((e) => {
  console.error('❌ Migration échouée :', (e as Error)?.message ?? e);
  process.exit(1);
});
