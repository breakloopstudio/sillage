// scripts/export-firestore.ts — Phase 1 migration Supabase
// Export de la collection Firestore `parfums` (~25K docs) vers NDJSON.
//
//   npm run export-firestore            # export (reprend au checkpoint si interrompu)
//   npm run export-firestore -- --fresh # repart de zéro
//
// Sortie : data/migration/parfums.ndjson (1 JSON/ligne, Timestamps → ISO).
// `searchKeywords` est jeté (remplacé par search_text/search_vector générés).

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';

const SERVICE_ACCOUNT_PATH = path.resolve('service-account.json');
const OUT_DIR = path.resolve('data', 'migration');
const OUT_FILE = path.join(OUT_DIR, 'parfums.ndjson');
const CHECKPOINT_FILE = path.join(OUT_DIR, 'export-checkpoint.json');
const PAGE_SIZE = 1000;

interface Checkpoint {
  lastId: string;
  count: number;
}

// Sérialisation récursive : Firestore Timestamp → ISO string.
// DocumentData est any-based côté admin SDK — accès dynamique justifié ici.
function serializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === 'object') {
    const maybeTs = v as { toDate?: () => Date };
    if (typeof maybeTs.toDate === 'function') return maybeTs.toDate().toISOString();
    if (Array.isArray(v)) return v.map(serializeValue);
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = serializeValue(val);
    }
    return out;
  }
  return v;
}

async function main(): Promise<void> {
  const fresh = process.argv.includes('--fresh');

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error('service-account.json introuvable à la racine du projet.');
  }
  if (getApps().length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    initializeApp({ credential: cert(serviceAccount) });
  }
  const db = getFirestore();

  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (fresh) {
    if (fs.existsSync(OUT_FILE)) fs.unlinkSync(OUT_FILE);
    if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
    console.log('Mode --fresh : export reparti de zéro.');
  }

  let lastId: string | null = null;
  let total = 0;
  if (!fresh && fs.existsSync(CHECKPOINT_FILE) && fs.existsSync(OUT_FILE)) {
    const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')) as Checkpoint;
    lastId = cp.lastId;
    total = cp.count;
    console.log(`Reprise au checkpoint : ${total} docs déjà exportés, dernier id = ${lastId}`);
  }

  const out = fs.createWriteStream(OUT_FILE, { flags: 'a' });
  const t0 = Date.now();

  try {
    for (;;) {
      let q = db.collection('parfums').orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
      if (lastId) q = q.startAfter(lastId);
      const snap = await q.get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        const data = doc.data();
        delete (data as Record<string, unknown>).searchKeywords; // remplacé par colonnes générées
        const row = serializeValue({ id: doc.id, ...data });
        out.write(JSON.stringify(row) + '\n');
        total++;
      }

      lastId = snap.docs[snap.docs.length - 1].id;
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastId, count: total }));
      console.log(`  … ${total} docs exportés (dernier : ${lastId})`);

      if (snap.size < PAGE_SIZE) break;
    }
  } finally {
    await new Promise<void>((resolve) => out.end(resolve));
  }

  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
  const sizeMb = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\n✅ Export terminé : ${total} parfums → ${OUT_FILE} (${sizeMb} Mo, ${elapsed}s)`);
}

main().catch((e) => {
  console.error('❌ Export échoué :', (e as Error)?.message ?? e);
  process.exit(1);
});
