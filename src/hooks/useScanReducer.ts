// src/hooks/useScanReducer.ts — State machine du scan
// useReducer pur, testable, pas de side effects

import { useReducer } from 'react';
import type { ScanResult, Parfum, CollectionMatch } from '../models';

// ─── Types ────────────────────────────────────────────────

export type ScanState =
  | { kind: 'idle' }
  | { kind: 'camera' }
  | { kind: 'scanning'; images?: string[]; scanResult?: ScanResult }
  | { kind: 'clarify'; scanResult: ScanResult; reason: 'low-confidence' | 'empty-response' | 'manual' }
  | { kind: 'results'; parfums: Parfum[]; confidence?: 'high' | 'low'; read?: ScanResult | null }
  | { kind: 'collection-results'; matches: CollectionMatch[]; estimatedCount: number }
  | { kind: 'no-result'; scanResult: ScanResult }
  | { kind: 'error'; message: string };

export type ScanAction =
  | { type: 'OPEN_CAMERA' }
  | { type: 'CANCEL_CAMERA' }
  | { type: 'START_SCAN'; images?: string[]; scanResult?: ScanResult }
  | { type: 'SCAN_SUCCESS'; parfums: Parfum[]; confidence?: 'high' | 'low'; read?: ScanResult | null }
  | { type: 'COLLECTION_SCAN_SUCCESS'; matches: CollectionMatch[]; estimatedCount: number }
  | { type: 'SCAN_CLARIFY'; scanResult: ScanResult; reason: 'low-confidence' | 'empty-response' }
  | { type: 'SCAN_NO_RESULT'; scanResult: ScanResult }
  | { type: 'SCAN_ERROR'; message: string }
  | { type: 'OPEN_MANUAL' }
  | { type: 'RESET' };

// ─── Reducer ───────────────────────────────────────────────

export function scanReducer(state: ScanState, action: ScanAction): ScanState {
  switch (action.type) {
    case 'OPEN_CAMERA':   return { kind: 'camera' };
    case 'CANCEL_CAMERA': return { kind: 'idle' };
    case 'START_SCAN':    return { kind: 'scanning', images: action.images, scanResult: action.scanResult };
    case 'SCAN_SUCCESS':  return { kind: 'results', parfums: action.parfums, confidence: action.confidence, read: action.read };
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
