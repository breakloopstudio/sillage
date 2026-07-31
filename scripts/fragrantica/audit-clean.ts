/**
 * Audit de qualité de data/clean — vérifie empiriquement la fidélité des champs
 * avant import en base, au lieu de corriger au cas où. Lecture seule, aucune
 * écriture. Rapporte, pour chaque champ, les défauts mesurés + exemples.
 *
 * Champs audités : notes (tête/cœur/fond), accords principaux (+ %), saisons,
 * longévité, sillage.
 *
 * Usage : npm run audit-clean [--limit=N] [--sample=M]
 */

import * as fs from 'fs';
import * as path from 'path';
import { argValue } from '../lib/script-utils';

const CLEAN_DIR = path.resolve('data', 'clean');

interface Note { name?: string }
interface Accord { accord?: string; value?: number }
interface Pyramid { type?: string; topNotes?: Note[]; middleNotes?: Note[]; baseNotes?: Note[] }
interface Entry {
  title?: string;
  brandName?: string;
  pyramid?: Pyramid | null;
  mainAccords?: Accord[];
  seasonBreakout?: Record<string, number> | null;
  longevityAverage?: number | null;
  sillageAverage?: number | null;
}

function normNote(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function addExample(arr: string[], ex: string, cap = 5): void {
  if (arr.length < cap) arr.push(ex);
}

function main(): void {
  const limit = Number(argValue('limit') ?? '0') || 0;
  const sample = Number(argValue('sample') ?? '5') || 5;

  const files = fs.readdirSync(CLEAN_DIR).filter((f) => f.endsWith('.json'));
  let entries: Entry[] = [];
  for (const file of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(CLEAN_DIR, file), 'utf8'));
      if (Array.isArray(parsed)) entries = entries.concat(parsed);
    } catch { /* skip */ }
  }
  if (limit > 0) entries = entries.slice(0, limit);

  const total = entries.length;

  // ─── Pyramide / notes ───
  let withPyramid = 0;
  const pyramidTypes = new Map<string, number>();
  let noNotesAtAll = 0;
  const noNotesEx: string[] = [];
  let dupHeadHeart = 0, dupHeadBase = 0, dupHeartBase = 0;
  const dupEx: string[] = [];
  let emptyNoteNames = 0;
  const emptyNoteEx: string[] = [];

  // ─── Accords ───
  let withAccords = 0;
  let noAccords = 0;
  const noAccordsEx: string[] = [];
  let nonSorted = 0;
  const nonSortedEx: string[] = [];
  let badValue = 0;
  const badValueEx: string[] = [];

  // ─── Saisons ───
  const seasonKeys = new Map<string, number>();
  let unexpectedSeasonKey = 0;
  const unexpectedSeasonEx: string[] = [];
  const EXPECTED_SEASON = new Set(['winter', 'spring', 'summer', 'autumn', 'day', 'night']);

  // ─── Longévité / sillage ───
  let longNull = 0, sillNull = 0;
  let longOutOfRange = 0, sillOutOfRange = 0;
  const outOfRangeEx: string[] = [];

  for (const e of entries) {
    const label = `${e.brandName ?? '?'} / ${(e.title ?? '?').slice(0, 60)}`;

    // Pyramide
    const p = e.pyramid;
    const type = p?.type ?? '∅';
    pyramidTypes.set(type, (pyramidTypes.get(type) ?? 0) + 1);
    const top = (p?.topNotes ?? []).map((n) => normNote(String(n.name ?? '')));
    const mid = (p?.middleNotes ?? []).map((n) => normNote(String(n.name ?? '')));
    const base = (p?.baseNotes ?? []).map((n) => normNote(String(n.name ?? '')));
    const all = [...top, ...mid, ...base].filter((x) => x.length > 0);
    if (p) withPyramid++;
    if (all.length === 0) { noNotesAtAll++; addExample(noNotesEx, label, sample); }
    const emptyCount = [...top, ...mid, ...base].filter((x) => x.length === 0).length;
    if (emptyCount > 0) { emptyNoteNames++; addExample(emptyNoteEx, `${label} (${emptyCount} vide(s))`, sample); }

    const setTop = new Set(top.filter(Boolean));
    const setMid = new Set(mid.filter(Boolean));
    const setBase = new Set(base.filter(Boolean));
    const iTopMid = [...setTop].filter((x) => setMid.has(x)).length;
    const iTopBase = [...setTop].filter((x) => setBase.has(x)).length;
    const iMidBase = [...setMid].filter((x) => setBase.has(x)).length;
    if (iTopMid > 0) dupHeadHeart++;
    if (iTopBase > 0) dupHeadBase++;
    if (iMidBase > 0) dupHeartBase++;
    if (iTopMid + iTopBase + iMidBase > 0) addExample(dupEx, `${label} (tête∩cœur:${iTopMid} tête∩fond:${iTopBase} cœur∩fond:${iMidBase})`, sample);

    // Accords
    const acc = e.mainAccords ?? [];
    if (acc.length > 0) {
      withAccords++;
      const vals = acc.map((a) => a.value);
      if (vals.some((v) => typeof v !== 'number' || !Number.isFinite(v as number) || (v as number) <= 0 || (v as number) > 100)) {
        badValue++;
        addExample(badValueEx, `${label} → ${JSON.stringify(vals)}`, sample);
      }
      let sorted = true;
      for (let i = 1; i < vals.length; i++) {
        const a = vals[i - 1] as number;
        const b = vals[i] as number;
        if (Number.isFinite(a) && Number.isFinite(b) && b > a) { sorted = false; break; }
      }
      if (!sorted) { nonSorted++; addExample(nonSortedEx, `${label} → ${JSON.stringify(vals)}`, sample); }
    } else {
      noAccords++;
      addExample(noAccordsEx, label, sample);
    }

    // Saisons
    const sb = e.seasonBreakout;
    if (sb) {
      for (const k of Object.keys(sb)) {
        seasonKeys.set(k, (seasonKeys.get(k) ?? 0) + 1);
        if (!EXPECTED_SEASON.has(k)) { unexpectedSeasonKey++; addExample(unexpectedSeasonEx, `${label} → "${k}"`, sample); }
      }
    }

    // Longévité / sillage
    if (e.longevityAverage == null) longNull++;
    else if (e.longevityAverage < 1 || e.longevityAverage > 5) { longOutOfRange++; addExample(outOfRangeEx, `${label} longévité=${e.longevityAverage}`, sample); }
    if (e.sillageAverage == null) sillNull++;
    else if (e.sillageAverage < 1 || e.sillageAverage > 4) { sillOutOfRange++; addExample(outOfRangeEx, `${label} sillage=${e.sillageAverage}`, sample); }
  }

  const pct = (n: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—');
  const section = (t: string) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);
  const show = (ex: string[]) => ex.forEach((x) => console.log(`      ${x}`));

  console.log(`\nAudit data/clean — ${total} entrées (${files.length} fichiers)`);

  section('Notes olfactives (pyramide)');
  console.log(`  Types de pyramide : ${[...pyramidTypes.entries()].map(([k, v]) => `${k}=${v} (${pct(v)})`).join('  ')}`);
  console.log(`  Sans AUCUNE note (3 strates vides) : ${noNotesAtAll} (${pct(noNotesAtAll)})`);
  show(noNotesEx);
  console.log(`  Notes à nom vide : ${emptyNoteNames} parfums`);
  show(emptyNoteEx);
  console.log(`  Doublons inter-strates : tête∩cœur=${dupHeadHeart}  tête∩fond=${dupHeadBase}  cœur∩fond=${dupHeartBase}  (parfums concernés)`);
  show(dupEx);

  section('Accords principaux');
  console.log(`  Avec accords : ${withAccords} (${pct(withAccords)})  ·  Sans accords : ${noAccords} (${pct(noAccords)})`);
  show(noAccordsEx);
  console.log(`  Séquence NON décroissante : ${nonSorted} (${pct(nonSorted)})`);
  show(nonSortedEx);
  console.log(`  Valeurs invalides (non-num / ≤0 / >100) : ${badValue} (${pct(badValue)})`);
  show(badValueEx);

  section('Saisons');
  console.log(`  Clés rencontrées : ${[...seasonKeys.entries()].map(([k, v]) => `${k}=${v}`).join('  ')}`);
  console.log(`  Clés INATTENDUES : ${unexpectedSeasonKey}`);
  show(unexpectedSeasonEx);

  section('Longévité / Sillage (moyennes de votes)');
  console.log(`  longévité null : ${longNull} (${pct(longNull)})  ·  sillage null : ${sillNull} (${pct(sillNull)})`);
  console.log(`  longévité hors [1..5] : ${longOutOfRange}  ·  sillage hors [1..4] : ${sillOutOfRange}`);
  show(outOfRangeEx);

  console.log('');
}

main();
