// src/utils/collection-scan.ts — Helpers purs du scan de collection (multi-flacons)

import type { CollectionDetection, CollectionMatch, Parfum } from '../models';

// Même seuil que le clarify du scan unitaire : en dessous, la détection est
// écartée (pas de match faible affiché comme une certitude dans une liste en lot).
export const COLLECTION_MATCH_THRESHOLD = 50;
// Sécurité : nombre max de détections envoyées au matching catalogue.
export const COLLECTION_MAX_DETECTIONS = 24;

/** Meilleur candidat catalogue d'une détection, ou null si aucun n'atteint le seuil. */
export function pickDetectionMatch(results: Array<Parfum & { _scanScore?: number }>): Parfum | null {
  const top = results[0];
  if (!top) return null;
  return (top._scanScore ?? 0) >= COLLECTION_MATCH_THRESHOLD ? top : null;
}

/** true si la détection mérite un matching catalogue (au moins une piste). */
export function isMatchableDetection(detection: CollectionDetection): boolean {
  return Boolean(detection.marque || detection.nom);
}

/** Déduplique les matches par id catalogue (deux détections → même flacon). */
export function dedupeCollectionMatches(matches: CollectionMatch[]): CollectionMatch[] {
  const seen = new Set<string>();
  const out: CollectionMatch[] = [];
  for (const m of matches) {
    if (seen.has(m.parfum.id)) continue;
    seen.add(m.parfum.id);
    out.push(m);
  }
  return out;
}

/** Sélection par défaut : uniquement les détections VÉRIFIÉES (texte lu, confiance
 *  haute) pas déjà en collection — les « Correspondance probable » restent à valider. */
export function defaultSelectedIds(matches: CollectionMatch[], ownedIds: Set<string>): Set<string> {
  const selected = new Set<string>();
  for (const m of matches) {
    if (m.confidence === 'high' && !ownedIds.has(m.parfum.id)) selected.add(m.parfum.id);
  }
  return selected;
}

/** true si le flacon est déjà dans la collection (n'importe quel statut). */
export function ownedIdSet(items: Array<{ parfumId: string }>): Set<string> {
  return new Set(items.map((i) => i.parfumId));
}
