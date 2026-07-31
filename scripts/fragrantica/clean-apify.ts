import * as fs from 'fs';
import * as path from 'path';

type RawEntry = Record<string, unknown>;

interface CleanStats {
  fileName: string;
  kept: number;
  removed: number;
  pct: string;
}

const TRACE_FIELDS = new Set([
  'id',
  'url',
  'brandUrl',
  'brandLogo',
  'description',
  'pros',
  'cons',
  'thisPerfumeRemindsMeOf',
  'peopleWhoLikeThisAlsoLike',
  'reviews',
  'images',
]);

const SUM_MAX_PATTERNS = ['Sum', 'Max'];

function stripNotes(notes: unknown): { name: string }[] {
  if (!Array.isArray(notes)) return [];
  return notes.map((n: Record<string, unknown>) => ({ name: String(n.name ?? '') }));
}

function cleanEntry(entry: RawEntry): RawEntry {
  for (const key of TRACE_FIELDS) {
    delete entry[key];
  }

  for (const key of Object.keys(entry)) {
    if (SUM_MAX_PATTERNS.some((p) => key.endsWith(p))) {
      delete entry[key];
    }
  }

  if (entry.pyramid) {
    const p = entry.pyramid as Record<string, unknown>;
    p.topNotes = stripNotes(p.topNotes);
    p.middleNotes = stripNotes(p.middleNotes);
    p.baseNotes = stripNotes(p.baseNotes);
    if (p.allNotes !== undefined) {
      p.allNotes = stripNotes(p.allNotes);
    }
  }

  if (Array.isArray(entry.mainAccords)) {
    entry.mainAccords = (entry.mainAccords as Record<string, unknown>[]).map((a) => ({
      accord: a.accord,
      value: a.value,
    }));
  }

  return entry;
}

function processFile(filePath: string, cleanDir: string): CleanStats {
  const fileName = path.basename(filePath);

  let entries: RawEntry[];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    entries = JSON.parse(raw);
  } catch {
    return { fileName, kept: 0, removed: 0, pct: 'SKIP' };
  }

  if (!Array.isArray(entries)) {
    return { fileName, kept: 0, removed: 0, pct: 'SKIP' };
  }

  const total = entries.length;
  if (total === 0) {
    return { fileName, kept: 0, removed: 0, pct: '0%' };
  }

  const brandCounts = new Map<string, number>();
  for (const e of entries) {
    const bn = String(e.brandName ?? '');
    brandCounts.set(bn, (brandCounts.get(bn) ?? 0) + 1);
  }
  const target = [...brandCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  entries = entries.filter((e) => e.brandName === target);

  entries = entries.filter((e) => {
    const t = String(e.title ?? '');
    return !t.includes('\uFFFD');
  });

  const seen = new Map<string, RawEntry>();
  for (const e of entries) {
    const id = String(e.id ?? '');
    if (!seen.has(id)) {
      seen.set(id, e);
    }
  }
  entries = [...seen.values()];

  entries = entries.map(cleanEntry);

  const outPath = path.join(cleanDir, fileName);
  fs.writeFileSync(outPath, JSON.stringify(entries), 'utf-8');

  const kept = entries.length;
  const removed = total - kept;
  const pct = total > 0 ? `${((kept / total) * 100) | 0}%` : '0%';

  return { fileName, kept, removed, pct };
}

function main(): void {
  const rawDir = path.resolve('data', 'raw');
  const cleanDir = path.resolve('data', 'clean');

  if (!fs.existsSync(rawDir)) {
    console.error(`Raw directory not found: ${rawDir}`);
    process.exit(1);
  }

  fs.mkdirSync(cleanDir, { recursive: true });

  const files = fs.readdirSync(rawDir).filter((f) => f.endsWith('.json'));

  console.log(`Processing ${files.length} files...\n`);

  let totalKept = 0;
  let totalRemoved = 0;
  const skipped: string[] = [];

  for (const file of files) {
    const s = processFile(path.join(rawDir, file), cleanDir);

    if (s.pct === 'SKIP') {
      skipped.push(file);
      console.log(`  SKIP ${file}`);
    } else {
      totalKept += s.kept;
      totalRemoved += s.removed;
      console.log(
        `  ${s.fileName.padEnd(35)} ${String(s.kept).padStart(5)} kept, ${String(s.removed).padStart(5)} removed  (${s.pct})`,
      );
    }
  }

  const totalEntries = totalKept + totalRemoved;
  const totalPct = totalEntries > 0 ? `${((totalKept / totalEntries) * 100) | 0}%` : '0%';

  console.log(`\n${'\u2500'.repeat(58)}`);
  console.log(`Total: ${totalKept} kept, ${totalRemoved} removed  (${totalPct})`);

  if (skipped.length > 0) {
    console.log(`Skipped: ${skipped.length} file(s)`);
  }
}

main();
