// État partagé minimal pour passer une query du Scan vers le Catalogue
// + pont pour passer les données parfum du Catalogue vers la fiche détail

import type { Parfum } from '../models';

let _pendingQuery: string | null = null;
let _pendingParfum: Parfum | null = null;

export function setPendingCatalogQuery(q: string) { _pendingQuery = q; }
export function consumePendingCatalogQuery(): string | null {
  const q = _pendingQuery;
  _pendingQuery = null;
  return q;
}

export function setPendingParfum(p: Parfum) {
  if (__DEV__) console.log('[bridge] setPendingParfum:', p.id, p.marque, p.nom);
  _pendingParfum = p;
}
export function consumePendingParfum(): Parfum | null {
  const p = _pendingParfum;
  _pendingParfum = null;
  if (__DEV__) console.log('[bridge] consumePendingParfum:', p?.id);
  return p;
}

// ─── Voix : auto-ouverture fiche + bannière « Ce n'est pas lui ? » ───
// SearchChrome/search → fiche (payload consommé au mount si l'id correspond) ;
// fiche → SearchChrome (résultats restaurés quand la bannière ramène en arrière).

export interface VoiceAutoOpenPayload {
  parfumId: string;
  query: string;
  results: Parfum[];
  createdAt: number;
}

const VOICE_BRIDGE_TTL_MS = 120_000;

let _pendingVoiceAutoOpen: VoiceAutoOpenPayload | null = null;
let _pendingVoiceResults: { query: string; results: Parfum[]; createdAt: number } | null = null;

export function setPendingVoiceAutoOpen(payload: Omit<VoiceAutoOpenPayload, 'createdAt'>) {
  _pendingVoiceAutoOpen = { ...payload, createdAt: Date.now() };
}
export function consumePendingVoiceAutoOpen(parfumId: string): VoiceAutoOpenPayload | null {
  const p = _pendingVoiceAutoOpen;
  _pendingVoiceAutoOpen = null;
  if (!p || p.parfumId !== parfumId) return null;
  if (Date.now() - p.createdAt > VOICE_BRIDGE_TTL_MS) return null;
  return p;
}

export function setPendingVoiceResults(query: string, results: Parfum[]) {
  _pendingVoiceResults = { query, results, createdAt: Date.now() };
}
export function consumePendingVoiceResults(): { query: string; results: Parfum[] } | null {
  const p = _pendingVoiceResults;
  _pendingVoiceResults = null;
  if (!p) return null;
  if (Date.now() - p.createdAt > VOICE_BRIDGE_TTL_MS) return null;
  return { query: p.query, results: p.results };
}
