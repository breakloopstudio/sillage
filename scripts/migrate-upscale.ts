/**
 * Migration upscale ×4 — Real-ESRGAN (Python + CUDA, workers persistants)
 *
 * Télécharge chaque image WebP depuis Supabase Storage, upscale ×4 via un pool
 * de workers Python persistants (scripts/upscale/upscale_worker.py) : le modèle
 * est chargé UNE fois par worker, les images défilent en JSON-lines stdin/stdout.
 * Reconvertit en WebP, upload primary_2x.webp, met à jour Postgres (image_url_2x).
 *
 * Usage:
 *   npm run migrate-upscale                  Migration complète (reprend au checkpoint)
 *   npm run migrate-upscale -- --dry-run     Simulation sans écriture
 *   npm run migrate-upscale -- --limit=50    Test sur 50 images
 *   npm run migrate-upscale -- --fresh       Ignore le checkpoint
 *   npm run migrate-upscale -- --scale=2     Upscale ×2 au lieu de ×4
 *
 * Prérequis : venv scripts/upscale/venv (Python 3.10 + torch CUDA + realesrgan)
 * Voir scripts/upscale/README.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { spawn, type ChildProcess } from 'child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BUCKET = 'parfum-images';
const PYTHON_BIN = path.resolve('scripts/upscale/venv/Scripts/python.exe');
const UPSCALE_WORKER = path.resolve('scripts/upscale/upscale_worker.py');
const PROGRESS_FILE = path.resolve('data/migration/upscale-progress.json');
const FAILED_FILE = path.resolve('data/migration/upscale-failed.json');

const CONCURRENCY = 2;
const WEBP_QUALITY = 85;
const READY_TIMEOUT_MS = 120_000;
const SAVE_EVERY = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Candidate {
  id: string;
  imageUrl: string;
}

interface Progress {
  done: string[];
  failed: { id: string; reason: string }[];
}

interface JobResult {
  ok: boolean;
  width?: number;
  height?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Worker Python persistant (JSON-lines stdin/stdout)
// ---------------------------------------------------------------------------

class PythonWorker {
  readonly ready: Promise<void>;
  private child: ChildProcess;
  private stdin: NonNullable<ChildProcess['stdin']>;
  private rl: readline.Interface;
  private pending: ((r: JobResult) => void) | null = null;
  private readyResolve!: () => void;
  private readyReject!: (e: Error) => void;
  private readyDone = false;
  private dead = false;

  constructor(scriptPath: string) {
    this.child = spawn(PYTHON_BIN, [scriptPath], { stdio: ['pipe', 'pipe', 'inherit'] });
    const stdout = this.child.stdout;
    const stdin = this.child.stdin;
    if (!stdout || !stdin) throw new Error('stdio du worker python indisponible');
    this.stdin = stdin;
    this.rl = readline.createInterface({ input: stdout });
    this.ready = new Promise((res, rej) => {
      this.readyResolve = res;
      this.readyReject = rej;
    });

    this.rl.on('line', (line) => this.onLine(line));
    this.child.on('exit', (code) => {
      this.dead = true;
      const err = new Error(`worker python exit code=${code}`);
      if (!this.readyDone) {
        this.readyDone = true;
        this.readyReject(err);
      }
      if (this.pending) {
        this.pending({ ok: false, error: err.message });
        this.pending = null;
      }
    });

    const timer = setTimeout(() => {
      if (!this.readyDone) {
        this.readyDone = true;
        this.readyReject(new Error('timeout démarrage worker'));
        this.kill();
      }
    }, READY_TIMEOUT_MS);
    this.ready.finally(() => clearTimeout(timer));
  }

  private onLine(line: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (!this.readyDone && 'ready' in msg) {
      this.readyDone = true;
      if (msg.ready === true) this.readyResolve();
      else this.readyReject(new Error((msg.error as string) ?? 'worker non prêt'));
      return;
    }
    if (this.pending) {
      const cb = this.pending;
      this.pending = null;
      cb(msg as unknown as JobResult);
    }
  }

  upscale(input: string, output: string, scale: number, quality: number): Promise<JobResult> {
    if (this.dead) return Promise.resolve({ ok: false, error: 'worker mort' });
    return new Promise((resolve) => {
      this.pending = resolve;
      this.stdin.write(JSON.stringify({ input, output, scale, quality }) + '\n');
    });
  }

  kill(): void {
    if (this.dead) return;
    try {
      this.stdin.end(JSON.stringify({ stop: true }) + '\n');
    } catch {
      /* ignore */
    }
    const c = this.child;
    const t = setTimeout(() => {
      try {
        c.kill();
      } catch {
        /* ignore */
      }
    }, 3000);
    t.unref?.();
  }
}

// ---------------------------------------------------------------------------
// .env minimal
// ---------------------------------------------------------------------------

function readEnvVar(key: string): string | undefined {
  try {
    const content = fs.readFileSync(path.resolve('.env'), 'utf8');
    const m = content.match(new RegExp(`^${key}\\s*=\\s*(.+?)\\s*$`, 'm'));
    return m ? m[1] : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

function loadProgress(fresh: boolean): Progress {
  if (!fresh && fs.existsSync(PROGRESS_FILE)) {
    const p = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) as Progress;
    console.log(`Reprise : ${p.done.length} déjà faites, ${p.failed.length} échecs (retentés).`);
    return p;
  }
  return { done: [], failed: [] };
}

function saveProgress(p: Progress): void {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p));
}

// ---------------------------------------------------------------------------
// Formatage
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// ---------------------------------------------------------------------------
// Traitement d'un parfum
// ---------------------------------------------------------------------------

async function processOne(
  supabase: SupabaseClient,
  supaUrl: string,
  candidate: Candidate,
  scale: number,
  dryRun: boolean,
  py: PythonWorker | null,
): Promise<void> {
  const srcPath = `parfums/${candidate.id}/primary.webp`;
  const destPath = `parfums/${candidate.id}/primary_2x.webp`;

  const { data: dlData, error: dlErr } = await supabase.storage.from(BUCKET).download(srcPath);
  if (dlErr) throw new Error(`download: ${dlErr.message}`);

  const webpBuffer = Buffer.from(await dlData.arrayBuffer());
  if (webpBuffer.length === 0) throw new Error('download: buffer vide');

  if (dryRun) {
    console.log(`  [DRY] ${candidate.id} : ${webpBuffer.length} o → ×${scale}`);
    return;
  }
  if (!py) throw new Error('worker python absent');

  const tmpIn = path.join(os.tmpdir(), `ups_${candidate.id}_in.webp`);
  const tmpOut = path.join(os.tmpdir(), `ups_${candidate.id}_out.png`);

  try {
    fs.writeFileSync(tmpIn, webpBuffer);
    const res = await py.upscale(tmpIn, tmpOut, scale, WEBP_QUALITY);
    if (!res.ok) throw new Error(`upscale: ${res.error ?? 'échec inconnu'}`);

    if (!fs.existsSync(tmpOut) || fs.statSync(tmpOut).size === 0) {
      throw new Error('upscale: output vide ou absent');
    }
    if ((res.width ?? 0) < 1000) {
      throw new Error(`upscale: dimensions inattendues ${res.width}×${res.height}`);
    }

    const upscaledPng = fs.readFileSync(tmpOut);
    const webp2x = await sharp(upscaledPng).webp({ quality: WEBP_QUALITY }).toBuffer();

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(destPath, webp2x, { contentType: 'image/webp', upsert: true });
    if (upErr) throw new Error(`upload: ${upErr.message}`);

    const publicUrl = `${supaUrl}/storage/v1/object/public/${BUCKET}/${destPath}`;
    const { error: dbErr } = await supabase
      .from('parfums')
      .update({ image_url_2x: publicUrl } as never)
      .eq('id', candidate.id);
    if (dbErr) throw new Error(`update db: ${dbErr.message}`);
  } finally {
    try { fs.unlinkSync(tmpIn); } catch { /* ignore */ }
    try { fs.unlinkSync(tmpOut); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Récupération paginée des candidats (PostgREST plafonne à 1000 lignes)
// ---------------------------------------------------------------------------

const PAGE_SIZE = 1000;

async function fetchAllCandidates(supabase: SupabaseClient): Promise<Candidate[]> {
  const out: Candidate[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('parfums')
      .select('id, image_url')
      .not('image_url', 'is', null)
      .is('image_url_2x', null)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`requete: ${error.message}`);

    const rows = data ?? [];
    for (const r of rows) out.push({ id: r.id as string, imageUrl: r.image_url as string });
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fresh = args.includes('--fresh');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;
  const scaleArg = args.find((a) => a.startsWith('--scale='));
  const scale = scaleArg ? Number(scaleArg.split('=')[1]) : 4;

  if (!fs.existsSync(PYTHON_BIN) || !fs.existsSync(UPSCALE_WORKER)) {
    console.error(`Worker Python introuvable : ${UPSCALE_WORKER}`);
    console.error('Voir scripts/upscale/README.md pour l\'installation du venv.');
    process.exit(1);
  }

  const supaUrl = readEnvVar('EXPO_PUBLIC_SUPABASE_URL');
  const supaKey = readEnvVar('SUPABASE_SERVICE_ROLE_KEY');
  if (!supaUrl || !supaKey) {
    console.error('EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env');
    process.exit(1);
  }

  const supabase: SupabaseClient = createClient(supaUrl, supaKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Échelle    : ×${scale}`);
  console.log(`Parallèle  : ${CONCURRENCY}`);
  console.log(`Qualité    : WebP ${WEBP_QUALITY}`);
  if (dryRun) console.log('*** DRY RUN — aucune écriture ***');
  console.log('');

  console.log('Requête catalogue (pagination)...');
  const all = await fetchAllCandidates(supabase);
  console.log(`${all.length} parfums sans image_2x.\n`);

  const progress = loadProgress(fresh);
  const doneSet = new Set(progress.done);
  let todo = all.filter((c) => !doneSet.has(c.id));
  if (limit !== null) todo = todo.slice(0, limit);

  console.log(`${todo.length} à traiter (${doneSet.size} déjà faites).\n`);
  if (todo.length === 0) {
    console.log('Rien à faire.');
    return;
  }

  let pyWorkers: PythonWorker[] = [];
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) process.exit(1);
    shuttingDown = true;
    process.stderr.write('\nArrêt gracieux — sauvegarde...\n');
    for (const w of pyWorkers) w.kill();
    saveProgress(progress);
    fs.writeFileSync(FAILED_FILE, JSON.stringify(progress.failed, null, 2));
    process.stderr.write(`${progress.done.length} faites. Relancer : npm run migrate-upscale\n`);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (!dryRun) {
    console.log(`Initialisation de ${CONCURRENCY} workers Python (chargement modèle)...`);
    pyWorkers = await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        const w = new PythonWorker(UPSCALE_WORKER);
        await w.ready;
        return w;
      }),
    );
    console.log('Workers prêts.\n');
  }

  const t0 = Date.now();
  let processed = 0;
  const failedNow: { id: string; reason: string }[] = [];

  let cursor = 0;
  const runWorker = async (py: PythonWorker | null): Promise<void> => {
    for (;;) {
      if (shuttingDown) return;
      const idx = cursor++;
      if (idx >= todo.length) return;
      const c = todo[idx];

      try {
        await processOne(supabase, supaUrl, c, scale, dryRun, py);
        if (!dryRun) progress.done.push(c.id);
      } catch (e: unknown) {
        const reason = (e as Error)?.message?.slice(0, 120) ?? String(e);
        failedNow.push({ id: c.id, reason });
        progress.failed.push({ id: c.id, reason });
      }

      processed++;
      if (processed % SAVE_EVERY === 0 || processed === todo.length) {
        saveProgress(progress);
        const elapsed = Date.now() - t0;
        const rate = processed / (elapsed / 1000);
        const eta = (todo.length - processed) / Math.max(rate, 0.001);
        const pct = ((processed / todo.length) * 100).toFixed(1);
        process.stdout.write(
          `\r[${pct.padStart(5)}%] ${processed}/${todo.length} | ` +
            `OK: ${progress.done.length} | Échecs: ${failedNow.length} | ` +
            `${rate.toFixed(1)}/s | ETA: ${formatDuration(eta * 1000)}   `,
        );
      }
    }
  };

  const slots: (PythonWorker | null)[] = dryRun
    ? Array.from({ length: CONCURRENCY }, () => null)
    : pyWorkers;
  await Promise.all(slots.map((py) => runWorker(py)));

  for (const w of pyWorkers) w.kill();
  saveProgress(progress);
  fs.writeFileSync(FAILED_FILE, JSON.stringify(failedNow, null, 2));

  const totalTime = Date.now() - t0;
  console.log('\n');
  console.log('═'.repeat(58));
  console.log(`Migration upscale terminée en ${formatDuration(totalTime)}`);
  console.log(`  Réussies  : ${progress.done.length}`);
  console.log(`  Échecs    : ${failedNow.length}`);
  if (failedNow.length > 0) console.log(`  → Détail  : ${FAILED_FILE}`);
  console.log('═'.repeat(58));
}

main().catch((e) => {
  console.error('Erreur fatale :', (e as Error)?.message ?? e);
  process.exit(1);
});
