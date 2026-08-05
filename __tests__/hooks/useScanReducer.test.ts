import { scanReducer } from '../../src/hooks/useScanReducer';
import type { ScanState, ScanAction } from '../../src/hooks/useScanReducer';
import type { ScanResult, Parfum, CollectionMatch } from '../../src/models';

function makeParfum(overrides: Partial<Parfum> = {}): Parfum {
  return {
    id: 'test_parfum_1',
    marque: 'Test Brand',
    nom: 'Test Name',
    familleOlactive: 'floral',
    notesTete: ['bergamot'],
    notesCoeur: ['rose'],
    notesFond: ['vanilla'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    marque: 'Dior',
    nom: 'Sauvage',
    volumeMl: 100,
    typeParfum: 'EDT',
    ...overrides,
  };
}

describe('scanReducer', () => {
  const idle: ScanState = { kind: 'idle' };
  const camera: ScanState = { kind: 'camera' };
  const scanning: ScanState = { kind: 'scanning' };
  const parfums = [makeParfum()];
  const scanResult = makeScanResult();

  describe('OPEN_CAMERA', () => {
    it('transitions from idle to camera', () => {
      expect(scanReducer(idle, { type: 'OPEN_CAMERA' })).toEqual({ kind: 'camera' });
    });

    it('transitions from any state to camera', () => {
      expect(scanReducer(scanning, { type: 'OPEN_CAMERA' })).toEqual({ kind: 'camera' });
    });
  });

  describe('CANCEL_CAMERA', () => {
    it('transitions from camera to idle', () => {
      expect(scanReducer(camera, { type: 'CANCEL_CAMERA' })).toEqual({ kind: 'idle' });
    });

    it('returns idle from any state', () => {
      expect(scanReducer(scanning, { type: 'CANCEL_CAMERA' })).toEqual({ kind: 'idle' });
    });
  });

  describe('START_SCAN', () => {
    it('transitions to scanning', () => {
      expect(scanReducer(idle, { type: 'START_SCAN' })).toEqual({ kind: 'scanning' });
    });

    it('resets even if already scanning', () => {
      const scanningWithImages: ScanState = { kind: 'scanning', images: ['a'] };
      expect(scanReducer(scanningWithImages, { type: 'START_SCAN' })).toEqual({ kind: 'scanning' });
    });

    it('stores images payload in scanning state', () => {
      const images = ['data:image/jpeg;base64,aabbcc'];
      const result = scanReducer(idle, { type: 'START_SCAN', images });
      expect(result).toMatchObject({ kind: 'scanning', images });
    });

    it('stores scanResult payload in scanning state', () => {
      const result = scanReducer(idle, { type: 'START_SCAN', scanResult });
      expect(result).toMatchObject({ kind: 'scanning', scanResult });
    });
  });

  describe('SCAN_SUCCESS', () => {
    it('transitions to results with parfums', () => {
      expect(scanReducer(scanning, { type: 'SCAN_SUCCESS', parfums })).toEqual({
        kind: 'results',
        parfums,
      });
    });

    it('works with empty parfums array', () => {
      expect(scanReducer(scanning, { type: 'SCAN_SUCCESS', parfums: [] })).toEqual({
        kind: 'results',
        parfums: [],
      });
    });
  });

  describe('COLLECTION_SCAN_SUCCESS', () => {
    const matches: CollectionMatch[] = [
      { parfum: makeParfum(), confidence: 'high', textRead: true, visualMatch: false },
    ];

    it('transitions from scanning to collection-results', () => {
      expect(scanReducer(scanning, { type: 'COLLECTION_SCAN_SUCCESS', matches, estimatedCount: 3 })).toEqual({
        kind: 'collection-results',
        matches,
        estimatedCount: 3,
      });
    });

    it('works with empty matches array', () => {
      expect(scanReducer(scanning, { type: 'COLLECTION_SCAN_SUCCESS', matches: [], estimatedCount: 0 })).toEqual({
        kind: 'collection-results',
        matches: [],
        estimatedCount: 0,
      });
    });

    it('collection-results → RESET → idle', () => {
      const state: ScanState = { kind: 'collection-results', matches, estimatedCount: 2 };
      expect(scanReducer(state, { type: 'RESET' })).toEqual({ kind: 'idle' });
    });
  });

  describe('COLLECTION_ADD_PHOTOS / COLLECTION_REMOVE_PHOTO (staging)', () => {
    it('idle + 1 photo → collection-staging', () => {
      expect(scanReducer(idle, { type: 'COLLECTION_ADD_PHOTOS', images: ['a'] })).toEqual({
        kind: 'collection-staging', images: ['a'],
      });
    });

    it('staging + photos → accumulation', () => {
      const staging: ScanState = { kind: 'collection-staging', images: ['a'] };
      expect(scanReducer(staging, { type: 'COLLECTION_ADD_PHOTOS', images: ['b', 'c'] })).toEqual({
        kind: 'collection-staging', images: ['a', 'b', 'c'],
      });
    });

    it('plafonné à COLLECTION_MAX_PHOTOS (4)', () => {
      const staging: ScanState = { kind: 'collection-staging', images: ['a', 'b', 'c'] };
      expect(scanReducer(staging, { type: 'COLLECTION_ADD_PHOTOS', images: ['d', 'e'] })).toEqual({
        kind: 'collection-staging', images: ['a', 'b', 'c', 'd'],
      });
    });

    it("n'accepte pas de photos depuis un autre état (results)", () => {
      const results: ScanState = { kind: 'results', parfums };
      expect(scanReducer(results, { type: 'COLLECTION_ADD_PHOTOS', images: ['a'] })).toEqual(results);
    });

    it('camera + photos → collection-staging (capture pendant la caméra)', () => {
      const camera: ScanState = { kind: 'camera' };
      expect(scanReducer(camera, { type: 'COLLECTION_ADD_PHOTOS', images: ['a'] })).toEqual({
        kind: 'collection-staging', images: ['a'],
      });
    });

    it('images vides → état inchangé', () => {
      expect(scanReducer(idle, { type: 'COLLECTION_ADD_PHOTOS', images: [] })).toEqual(idle);
    });

    it('staging → OPEN_CAMERA porte les photos posées (staged)', () => {
      const staging: ScanState = { kind: 'collection-staging', images: ['a', 'b'] };
      expect(scanReducer(staging, { type: 'OPEN_CAMERA' })).toEqual({
        kind: 'camera', staged: ['a', 'b'],
      });
    });

    it('camera (staged) + capture → fusion avec les photos déjà posées', () => {
      const camera: ScanState = { kind: 'camera', staged: ['a', 'b'] };
      expect(scanReducer(camera, { type: 'COLLECTION_ADD_PHOTOS', images: ['c'] })).toEqual({
        kind: 'collection-staging', images: ['a', 'b', 'c'],
      });
    });

    it('camera (staged) + CANCEL_CAMERA → staging restauré', () => {
      const camera: ScanState = { kind: 'camera', staged: ['a', 'b'] };
      expect(scanReducer(camera, { type: 'CANCEL_CAMERA' })).toEqual({
        kind: 'collection-staging', images: ['a', 'b'],
      });
    });

    it('camera sans staged + CANCEL_CAMERA → idle', () => {
      const camera: ScanState = { kind: 'camera' };
      expect(scanReducer(camera, { type: 'CANCEL_CAMERA' })).toEqual({ kind: 'idle' });
    });

    it('boucle complète : staging → section → capture → staging enrichi', () => {
      let state: ScanState = { kind: 'idle' };
      state = scanReducer(state, { type: 'OPEN_CAMERA' });
      state = scanReducer(state, { type: 'COLLECTION_ADD_PHOTOS', images: ['a'] });
      expect(state).toEqual({ kind: 'collection-staging', images: ['a'] });
      state = scanReducer(state, { type: 'OPEN_CAMERA' });           // « Ajouter une section »
      expect(state).toEqual({ kind: 'camera', staged: ['a'] });
      state = scanReducer(state, { type: 'COLLECTION_ADD_PHOTOS', images: ['b'] });
      expect(state).toEqual({ kind: 'collection-staging', images: ['a', 'b'] });
      state = scanReducer(state, { type: 'OPEN_CAMERA' });           // 3e section puis annulation
      state = scanReducer(state, { type: 'CANCEL_CAMERA' });
      expect(state).toEqual({ kind: 'collection-staging', images: ['a', 'b'] });
    });

    it('retire une photo par index', () => {
      const staging: ScanState = { kind: 'collection-staging', images: ['a', 'b', 'c'] };
      expect(scanReducer(staging, { type: 'COLLECTION_REMOVE_PHOTO', index: 1 })).toEqual({
        kind: 'collection-staging', images: ['a', 'c'],
      });
    });

    it('dernière photo retirée → idle', () => {
      const staging: ScanState = { kind: 'collection-staging', images: ['a'] };
      expect(scanReducer(staging, { type: 'COLLECTION_REMOVE_PHOTO', index: 0 })).toEqual({ kind: 'idle' });
    });

    it('staging → analyse → collection-results → reset', () => {
      let state: ScanState = { kind: 'idle' };
      state = scanReducer(state, { type: 'COLLECTION_ADD_PHOTOS', images: ['a', 'b'] });
      expect(state.kind).toBe('collection-staging');
      state = scanReducer(state, { type: 'START_SCAN', images: ['a', 'b'] });
      expect(state.kind).toBe('scanning');
      state = scanReducer(state, { type: 'COLLECTION_SCAN_SUCCESS', matches: [], estimatedCount: 2 });
      expect(state.kind).toBe('collection-results');
      state = scanReducer(state, { type: 'RESET' });
      expect(state.kind).toBe('idle');
    });
  });

  describe('SCAN_CLARIFY', () => {
    it('transitions to clarify with scan result', () => {
      expect(
        scanReducer(scanning, { type: 'SCAN_CLARIFY', scanResult, reason: 'low-confidence' })
      ).toEqual({ kind: 'clarify', scanResult, reason: 'low-confidence' });
    });

    it('handles empty-response reason', () => {
      expect(
        scanReducer(scanning, { type: 'SCAN_CLARIFY', scanResult, reason: 'empty-response' })
      ).toEqual({ kind: 'clarify', scanResult, reason: 'empty-response' });
    });
  });

  describe('SCAN_NO_RESULT', () => {
    it('transitions to no-result with scan result', () => {
      expect(scanReducer(scanning, { type: 'SCAN_NO_RESULT', scanResult })).toEqual({
        kind: 'no-result',
        scanResult,
      });
    });
  });

  describe('SCAN_ERROR', () => {
    it('transitions to error with message', () => {
      expect(scanReducer(idle, { type: 'SCAN_ERROR', message: 'Network error' })).toEqual({
        kind: 'error',
        message: 'Network error',
      });
    });

    it('works from any state', () => {
      expect(scanReducer(scanning, { type: 'SCAN_ERROR', message: 'Timeout' })).toEqual({
        kind: 'error',
        message: 'Timeout',
      });
    });
  });

  describe('OPEN_MANUAL', () => {
    it('transitions to clarify with manual reason and null result', () => {
      expect(scanReducer(idle, { type: 'OPEN_MANUAL' })).toEqual({
        kind: 'clarify',
        scanResult: { marque: null, nom: null, volumeMl: null, typeParfum: null },
        reason: 'manual',
      });
    });
  });

  describe('RESET', () => {
    it('returns idle from any state', () => {
      expect(scanReducer(camera, { type: 'RESET' })).toEqual({ kind: 'idle' });
      expect(scanReducer(scanning, { type: 'RESET' })).toEqual({ kind: 'idle' });
      expect(
        scanReducer({ kind: 'results', parfums }, { type: 'RESET' })
      ).toEqual({ kind: 'idle' });
      expect(
        scanReducer({ kind: 'error', message: 'err' }, { type: 'RESET' })
      ).toEqual({ kind: 'idle' });
    });
  });

  describe('unknown action', () => {
    it('returns current state unchanged', () => {
      // @ts-expect-error — testing runtime behavior with invalid action
      expect(scanReducer(idle, { type: 'INVALID' })).toEqual({ kind: 'idle' });
    });
  });

  describe('state machine — full flows', () => {
    it('idle → camera → cancel → idle', () => {
      let state: ScanState = { kind: 'idle' };
      state = scanReducer(state, { type: 'OPEN_CAMERA' });
      expect(state.kind).toBe('camera');
      state = scanReducer(state, { type: 'CANCEL_CAMERA' });
      expect(state.kind).toBe('idle');
    });

    it('idle → scan → success', () => {
      let state: ScanState = { kind: 'idle' };
      state = scanReducer(state, { type: 'START_SCAN' });
      expect(state).toEqual({ kind: 'scanning' });
      state = scanReducer(state, { type: 'SCAN_SUCCESS', parfums });
      expect(state).toEqual({ kind: 'results', parfums });
      state = scanReducer(state, { type: 'RESET' });
      expect(state.kind).toBe('idle');
    });

    it('idle → scan → error → reset', () => {
      let state: ScanState = { kind: 'idle' };
      state = scanReducer(state, { type: 'START_SCAN' });
      state = scanReducer(state, { type: 'SCAN_ERROR', message: 'GPT failed' });
      expect(state).toEqual({ kind: 'error', message: 'GPT failed' });
      state = scanReducer(state, { type: 'RESET' });
      expect(state.kind).toBe('idle');
    });

    it('idle → scan → no-result → reset', () => {
      let state: ScanState = { kind: 'idle' };
      state = scanReducer(state, { type: 'START_SCAN' });
      state = scanReducer(state, { type: 'SCAN_NO_RESULT', scanResult });
      expect(state).toEqual({ kind: 'no-result', scanResult });
      state = scanReducer(state, { type: 'RESET' });
      expect(state.kind).toBe('idle');
    });

    it('idle → open manual → clarify', () => {
      let state: ScanState = { kind: 'idle' };
      state = scanReducer(state, { type: 'OPEN_MANUAL' });
      expect(state.kind).toBe('clarify');
      expect((state as { reason: string }).reason).toBe('manual');
    });
  });
});
