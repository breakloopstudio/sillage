// src/utils/scan-display.ts — Résolution pure de l'affichage des résultats de scan.
// Chip de confiance + ligne « Lu/Hypothèse » selon la source de l'identification
// (texte lu vs forme) et la confirmation visuelle (re-ranking). Testé.
// Labels résolus via i18next à l'appel (§23).

import i18next from 'i18next';
import { normalize } from './normalize';
import type { Parfum, ScanResult } from '../models';

export interface ScanChip {
  label: string;
  icon: string;
  tone: 'deal' | 'fair';
}

/** Chip de confiance du héros — 5 combos (confiance × textRead × visualMatch).
 *  `read` accepte le sous-ensemble textRead/visualMatch (scan unitaire = ScanResult
 *  complet, détections collection = { textRead, visualMatch }). */
export function scanChip(
  confidence: 'high' | 'low' | undefined,
  read: Pick<ScanResult, 'textRead' | 'visualMatch'> | null | undefined,
): ScanChip {
  const isLow = confidence === 'low';
  const isShape = read?.textRead === false;
  const isVisual = read?.visualMatch === true;
  if (isVisual && !isLow) return { label: i18next.t('scan.chipVerified'), icon: 'checkmark-circle', tone: 'deal' };
  if (isShape) return { label: i18next.t('scan.chipShape'), icon: 'eye-outline', tone: 'fair' };
  if (isLow) return { label: i18next.t('scan.chipProbable'), icon: 'help-circle-outline', tone: 'fair' };
  return { label: i18next.t('scan.chipMatch'), icon: 'checkmark-circle', tone: 'deal' };
}

export interface ScanReadLine {
  prefix: string;
  text: string;
}

/** Ligne « Lu : … » / « Hypothèse : … » — null si elle ne ferait que doubler le héros.
 *  Toujours visible en reconnaissance de forme NON vérifiée (le cas dangereux où
 *  l'hypothèse égale le top match sans texte lu). */
export function scanReadLine(
  read: ScanResult | null | undefined,
  top: Parfum | null | undefined,
): ScanReadLine | null {
  if (!read || !top || (!read.marque && !read.nom)) return null;
  const isShape = read.textRead === false;
  const isVisual = read.visualMatch === true;
  const sameMarque = normalize(read.marque ?? '') === normalize(top.marque ?? '');
  const sameNom = normalize(read.nom ?? '') === normalize(top.nom ?? '');
  if (sameMarque && sameNom && (isVisual || !isShape)) return null;
  return {
    prefix: isShape && !isVisual ? i18next.t('scan.hypothesisPrefix') : i18next.t('scan.readPrefix'),
    text: [read.marque, read.nom].filter(Boolean).join(' · '),
  };
}
