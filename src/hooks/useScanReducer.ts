// src/hooks/useScanReducer.ts — State machine du scan
// useReducer pur, testable, pas de side effects

import { useReducer } from 'react';
import type { ScanResult, Parfum, CollectionMatch } from '../models';

// ─── Types ────────────────────────────────────────────────

export type ScanState =
  | { kind: 'idle' }
  // staged : photos déjà en staging quand la caméra est rouverte (« Ajouter une
  // section ») — préservées à la capture comme à l'annulation.
  | { kind: 'camera'; staged?: string[] }
  | { kind: 'scanning'; images?: string[]; scanResult?: ScanResult }
  | { kind: 'clarify'; scanResult: ScanResult; reason: 'low-confidence' | 'empty-response' | 'manual' }
  | { kind: 'results'; parfums: Parfum[]; confidence?: 'high' | 'low'; read?: ScanResult | null }
  | { kind: 'collection-staging'; images: string[] }
  | { kind: 'collection-results'; matches: CollectionMatch[]; estimatedCount: number }
  | { kind: 'no-result'; scanResult: ScanResult }
  | { kind: 'error'; message: string };

export type ScanAction =
  | { type: 'OPEN_CAMERA' }
  | { type: 'CANCEL_CAMERA' }
  | { type: 'START_SCAN'; images?: string[]; scanResult?: ScanResult }
  | { type: 'SCAN_SUCCESS'; parfums: Parfum[]; confidence?: 'high' | 'low'; read?: ScanResult | null }
  | { type: 'COLLECTION_ADD_PHOTOS'; images: string[] }
  | { type: 'COLLECTION_REMOVE_PHOTO'; index: number }
  | { type: 'COLLECTION_SCAN_SUCCESS'; matches: CollectionMatch[]; estimatedCount: number }
  | { type: 'SCAN_CLARIFY'; scanResult: ScanResult; reason: 'low-confidence' | 'empty-response' }
  | { type: 'SCAN_NO_RESULT'; scanResult: ScanResult }
  | { type: 'SCAN_ERROR'; message: string }
  | { type: 'OPEN_MANUAL' }
  | { type: 'RESET' };

// Photos de sections d'une collection (miroir de COLLECTION_MAX_IMAGES côté serveur).
export const COLLECTION_MAX_PHOTOS = 4;

// ─── Reducer ───────────────────────────────────────────────

export function scanReducer(state: ScanState, action: ScanAction): ScanState {
  switch (action.type) {
    case 'OPEN_CAMERA':   return { kind: 'camera', staged: state.kind === 'collection-staging' ? state.images : undefined };
    case 'CANCEL_CAMERA': {
      // Caméra ouverte depuis le staging → on RESTAURE les photos déjà posées.
      if (state.kind === 'camera' && state.staged && state.staged.length > 0) {
        return { kind: 'collection-staging', images: state.staged };
      }
      return { kind: 'idle' };
    }
    case 'START_SCAN':    return { kind: 'scanning', images: action.images, scanResult: action.scanResult };
    case 'SCAN_SUCCESS':  return { kind: 'results', parfums: action.parfums, confidence: action.confidence, read: action.read };
    case 'COLLECTION_ADD_PHOTOS': {
      // Staging multi-section : photos ajoutées depuis idle, staging OU camera
      // (la capture et l'import galerie arrivent pendant que l'état est 'camera').
      if (state.kind !== 'idle' && state.kind !== 'collection-staging' && state.kind !== 'camera') return state;
      if (action.images.length === 0) return state;
      const prev = state.kind === 'collection-staging'
        ? state.images
        : state.kind === 'camera'
          ? (state.staged ?? [])
          : [];
      return { kind: 'collection-staging', images: [...prev, ...action.images].slice(0, COLLECTION_MAX_PHOTOS) };
    }
    case 'COLLECTION_REMOVE_PHOTO': {
      if (state.kind !== 'collection-staging') return state;
      const images = state.images.filter((_, i) => i !== action.index);
      return images.length > 0 ? { kind: 'collection-staging', images } : { kind: 'idle' };
    }
    case 'COLLECTION_SCAN_SUCCESS': return { kind: 'collection-results', matches: action.matches, estimatedCount: action.estimatedCount };
    case 'SCAN_CLARIFY':  return { kind: 'clarify', scanResult: action.scanResult, reason: action.reason };
    case 'SCAN_NO_RESULT':return { kind: 'no-result', scanResult: action.scanResult };
    case 'SCAN_ERROR':    return { kind: 'error', message: action.message };
    case 'OPEN_MANUAL':   return { kind: 'clarify', scanResult: { marque: null, nom: null, volumeMl: null, typeParfum: null }, reason: 'manual' };
    case 'RESET':         return { kind: 'idle' };
    default:              return state;
  }
}

// ─── Hook ──────────────────────────────────────────────────

const initialState: ScanState = { kind: 'idle' };

export function useScanReducer() {
  const [state, dispatch] = useReducer(scanReducer, initialState);
  return { state, dispatch };
}
