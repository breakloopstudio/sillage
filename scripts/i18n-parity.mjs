#!/usr/bin/env node
// scripts/i18n-parity.mjs — Contrôle de parité des traductions (rules.md §23).
// Vérifie que chaque langue secondaire est alignée sur la langue source (fr) :
//   1. mêmes clés (ni manquante, ni supplémentaire),
//   2. aucune valeur vide,
//   3. interpolations {{…}} identiques,
//   4. aucune valeur égale à son propre chemin de clé (défaut type "runner.dailyCombo").
// Lecture seule, n'écrit rien. Exit code 1 si un problème est détecté (utilisable en CI).
//
// Usage : npm run i18n:check            (résumé)
//         npm run i18n:check -- --verbose (détaille aussi les valeurs identiques à la source)

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const verbose = process.argv.includes('--verbose');

// Langues + langue source dérivées de la config i18next-cli (jamais dupliquées ici).
const cfg = (await import(pathToFileURL(join(root, 'i18next.config.mjs')).href)).default;
const source = cfg.extract.primaryLanguage;
const locales = cfg.locales;
const secondaries = locales.filter((l) => l !== source);

const load = (lang) =>
  JSON.parse(readFileSync(join(root, 'src', 'locales', lang, 'common.json'), 'utf8'));

// Aplatit un objet imbriqué en { 'a.b.c': 'valeur' }.
function flatten(obj) {
  const out = {};
  const walk = (o, prefix) => {
    for (const k of Object.keys(o)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (o[k] !== null && typeof o[k] === 'object') walk(o[k], path);
      else out[path] = o[k];
    }
  };
  walk(obj, '');
  return out;
}

// Tokens d'interpolation normalisés et triés, pour comparaison FR ↔ langue cible.
const tokens = (s) =>
  (String(s).match(/{{\s*[\w.]+\s*}}/g) || []).map((t) => t.replace(/\s/g, '')).sort().join(',');

const src = flatten(load(source));
const srcKeys = Object.keys(src).sort();
let failed = false;

console.log(`i18n parity — source: ${source} (${srcKeys.length} clés) · langues: ${secondaries.join(', ') || '(aucune)'}`);

// La langue source ne doit contenir ni valeur vide, ni valeur égale au chemin de clé
// (défaut d'extraction qui afficherait la clé crue, ex. "runner.dailyCombo").
const srcEmpty = srcKeys.filter((k) => src[k] === '');
const srcSelfRef = srcKeys.filter((k) => src[k] === k);
if (srcEmpty.length || srcSelfRef.length) {
  failed = true;
  console.log(`\n[${source}] ${srcEmpty.length + srcSelfRef.length} problème(s) dans la SOURCE :`);
  for (const k of srcEmpty) console.log(`  ✗ VALEUR VIDE    ${k}`);
  for (const k of srcSelfRef) console.log(`  ✗ VALEUR=CLÉ     ${k}  (la valeur est le chemin de clé)`);
} else {
  console.log(`\n[${source}] OK — source propre`);
}

for (const lang of secondaries) {
  const tgt = flatten(load(lang));
  const tgtKeys = Object.keys(tgt).sort();
  const issues = [];

  const missing = srcKeys.filter((k) => !(k in tgt));
  const extra = tgtKeys.filter((k) => !(k in src));
  const empty = tgtKeys.filter((k) => tgt[k] === '');
  const interp = srcKeys.filter((k) => k in tgt && tgt[k] !== '' && tokens(src[k]) !== tokens(tgt[k]));
  const selfRef = tgtKeys.filter((k) => tgt[k] === k);

  for (const k of missing) issues.push(`CLÉ MANQUANTE  ${k}`);
  for (const k of extra) issues.push(`CLÉ EN TROP    ${k}`);
  for (const k of empty) issues.push(`VALEUR VIDE    ${k}`);
  for (const k of interp) issues.push(`INTERPOLATION  ${k}  (src: [${tokens(src[k])}] ≠ ${lang}: [${tokens(tgt[k])}])`);
  for (const k of selfRef) issues.push(`VALEUR=CLÉ     ${k}  (la valeur est le chemin de clé)`);

  if (issues.length) {
    failed = true;
    console.log(`\n[${lang}] ${issues.length} problème(s) :`);
    for (const i of issues) console.log(`  ✗ ${i}`);
  } else {
    console.log(`\n[${lang}] OK — ${tgtKeys.length} clés, parité 100 %`);
  }

  // Info (non bloquant) : valeurs restées identiques à la source. Peut être légitime
  // (cognats : "Sillage", "Pause", durées…) — listé seulement en --verbose.
  const identical = srcKeys.filter((k) => k in tgt && tgt[k] !== '' && tgt[k] === src[k]);
  if (identical.length) {
    console.log(`[${lang}] info: ${identical.length} valeur(s) identique(s) à la source (cognats attendus ou à relire)`);
    if (verbose) for (const k of identical) console.log(`    · ${k}`);
  }
}

if (failed) {
  console.log('\n✗ Parité i18n en défaut — corrige les problèmes ci-dessus (voir docs/i18n-runbook.md).');
  process.exit(1);
}
console.log('\n✓ Toutes les langues sont alignées sur la source.');
