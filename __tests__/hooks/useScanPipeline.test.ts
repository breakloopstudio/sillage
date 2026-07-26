// __tests__/hooks/useScanPipeline.test.ts — Pipeline analyse → résultats

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useScanPipeline } from '../../src/hooks/useScanPipeline';
import type { ScanAction } from '../../src/hooks/useScanReducer';
import type { ScanResult, Parfum } from '../../src/models';

// ── Mocks ───────────────────────────────────────────────

const mockAnalyze = jest.fn();
const mockAnalyzeMultiple = jest.fn();
jest.mock('../../src/services/openai-vision', () => ({
  analyzeImage: (...args: unknown[]) => mockAnalyze(...args),
  analyzeMultipleImages: (...args: unknown[]) => mockAnalyzeMultiple(...args),
}));

const mockSearch = jest.fn();
jest.mock('../../src/services/catalog', () => ({
  searchParfumFromScan: (...args: unknown[]) => mockSearch(...args),
}));

const mockSaveScan = jest.fn();
jest.mock('../../src/services/user-data', () => ({
  saveScan: (...args: unknown[]) => mockSaveScan(...args),
}));

const mockHapticsSuccess = jest.fn();
const mockHapticsError = jest.fn();
jest.mock('../../src/services/haptics', () => ({
  hapticsSuccess: () => mockHapticsSuccess(),
  hapticsError: () => mockHapticsError(),
}));

// ── Helpers ─────────────────────────────────────────────

function makeParfum(overrides: Partial<Parfum> = {}): Parfum {
  return {
    id: 'test_parfum_1',
    marque: 'Dior',
    nom: 'Sauvage',
    familleOlactive: 'aromatique',
    notesTete: ['bergamot'],
    notesCoeur: ['lavande'],
    notesFond: ['cedre'],
    bestPrice: 79.99,
    referencePrice: 99.99,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    marque: 'Dior',
    nom: 'Sauvage',
    volumeMl: 100,
    typeParfum: 'EDT',
    confidence: 'high',
    ...overrides,
  };
}

function setup(uid: string | null = 'test-uid', mounted = true) {
  const dispatch = jest.fn();
  const mountedRef = { current: mounted };
  const { result } = renderHook(() => useScanPipeline(dispatch, uid, mountedRef));
  return { dispatch, mountedRef, result };
}

describe('useScanPipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyze.mockResolvedValue(makeResult());
    mockAnalyzeMultiple.mockResolvedValue(makeResult());
    mockSearch.mockResolvedValue([makeParfum()]);
    mockSaveScan.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockAnalyze.mockReset().mockResolvedValue(makeResult());
    mockAnalyzeMultiple.mockReset().mockResolvedValue(makeResult());
    mockSearch.mockReset().mockResolvedValue([makeParfum()]);
    mockSaveScan.mockReset().mockResolvedValue(undefined);
  });

  // ── Pipeline normal ───────────────────────────────────

  it('analyse une image → cherche → dispatch SCAN_SUCCESS', async () => {
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ images: ['img1'] });
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'START_SCAN', images: ['img1'], scanResult: undefined });
    expect(mockAnalyze).toHaveBeenCalledWith('img1');
    expect(mockSearch).toHaveBeenCalledWith('Dior', 'Sauvage');
    expect(mockHapticsSuccess).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SCAN_SUCCESS' }));
  });

  it('burst 3 images → un seul appel analyzeMultipleImages(3)', async () => {
    const { dispatch, result } = setup();
    const images = ['img1', 'img2', 'img3'];
    await act(async () => {
      await result.current.startAnalysis({ images });
    });
    expect(mockAnalyzeMultiple).toHaveBeenCalledWith(images);
    expect(mockAnalyze).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SCAN_SUCCESS' }));
  });

  it('scanResult (clarify) → cherche → dispatch SCAN_SUCCESS', async () => {
    const { dispatch, result } = setup();
    const scanResult = makeResult();
    await act(async () => {
      await result.current.startAnalysis({ scanResult });
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'START_SCAN', images: undefined, scanResult });
    expect(mockSearch).toHaveBeenCalledWith('Dior', 'Sauvage');
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SCAN_SUCCESS' }));
  });

  // ── Résultats vides ───────────────────────────────────

  it('0 résultat → dispatch SCAN_NO_RESULT', async () => {
    mockSearch.mockResolvedValue([]);
    const { dispatch, result } = setup();
    const scanResult = makeResult();
    await act(async () => {
      await result.current.startAnalysis({ scanResult });
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SCAN_NO_RESULT', scanResult }));
  });

  // ── Low confidence → clarify ──────────────────────────

  it('GPT low confidence → dispatch SCAN_CLARIFY low-confidence', async () => {
    mockAnalyze.mockResolvedValue(makeResult({ confidence: 'low' }));
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ images: ['img1'] });
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCAN_CLARIFY',
      reason: 'low-confidence',
    }));
    // Ne doit pas chercher
    expect(mockSearch).not.toHaveBeenCalled();
  });

  // ── GPT ne trouve rien → clarify empty-response ──────

  it('GPT sans marque ni nom → dispatch SCAN_CLARIFY empty-response', async () => {
    mockAnalyze.mockResolvedValue(makeResult({ marque: null, nom: null, confidence: undefined }));
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ images: ['img1'] });
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCAN_CLARIFY',
      reason: 'empty-response',
    }));
  });

  // ── Erreurs ───────────────────────────────────────────

  it('GPT error → dispatch SCAN_ERROR', async () => {
    mockAnalyze.mockRejectedValue(new Error('API down'));
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ images: ['img1'] });
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SCAN_ERROR' }));
    expect(mockHapticsError).toHaveBeenCalled();
  });

  it('search error → dispatch SCAN_ERROR', async () => {
    mockSearch.mockRejectedValue(new Error('Network error'));
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ scanResult: makeResult() });
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SCAN_ERROR' }));
    expect(mockHapticsError).toHaveBeenCalled();
  });

  // ── Historique (saveScan) ─────────────────────────────

  it('saveScan appelé avec status success', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ scanResult: makeResult() });
    });
    expect(mockSaveScan).toHaveBeenCalledWith('test-uid', expect.objectContaining({ status: 'success' }));
  });

  it('saveScan appelé avec status no-result', async () => {
    mockSearch.mockResolvedValue([]);
    const { result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ scanResult: makeResult() });
    });
    expect(mockSaveScan).toHaveBeenCalledWith('test-uid', expect.objectContaining({ status: 'no-result' }));
  });

  it('saveScan appelé avec status error sur échec recherche', async () => {
    mockSearch.mockRejectedValue(new Error('fail'));
    const { result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ scanResult: makeResult() });
    });
    expect(mockSaveScan).toHaveBeenCalledWith('test-uid', expect.objectContaining({ status: 'error' }));
  });

  it('pas de saveScan si uid null', async () => {
    const { result } = setup(null);
    await act(async () => {
      await result.current.startAnalysis({ scanResult: makeResult() });
    });
    expect(mockSaveScan).not.toHaveBeenCalled();
  });

  // ── Garde-fous ────────────────────────────────────────

  it("n'exécute pas si déjà en cours", async () => {
    // Promesse qui ne se résout jamais → première analyse bloque le flag
    mockAnalyze.mockImplementation(() => new Promise(() => {}));
    const { dispatch, result } = setup();

    // Lance le premier appel (son analyse ne termine jamais)
    await act(async () => {
      void result.current.startAnalysis({ images: ['img1'] });
      // Laisser le microtask dispatcher START_SCAN
      await new Promise(r => setTimeout(r, 0));
    });

    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    dispatch.mockClear();

    // Deuxième appel → garde → retour immédiat sans dispatcher
    await act(async () => {
      await result.current.startAnalysis({ images: ['img2'] });
    });

    expect(mockAnalyze).toHaveBeenCalledTimes(1); // pas de 2e appel
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('ne dispatch pas après unmount', async () => {
    const dispatch = jest.fn();
    const mountedRef = { current: true };
    const { result, unmount } = renderHook(() => useScanPipeline(dispatch, 'test-uid', mountedRef));

    // Lance puis unmount pendant que l'analyse tourne
    let resolve: () => void;
    mockAnalyze.mockImplementation(() => new Promise<void>(r => { resolve = r; }));

    const p = act(() => {
      void result.current.startAnalysis({ images: ['img1'] });
      return new Promise(r => setTimeout(r, 0));
    });
    await p;

    // Unmount avant la fin de l'analyse
    unmount();

    // Résoudre l'analyse (ne doit RIEN dispatcher puisqu'unmounté)
    resolve!();
    // Laisser le microtask exécuter le callback
    await new Promise(r => setTimeout(r, 0));

    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SCAN_SUCCESS' }));
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SCAN_CLARIFY' }));
    // START_SCAN a pu passer avant l'unmount, c'est acceptable
  });

  // ── Payload invalide ──────────────────────────────────

  it('dispatch SCAN_ERROR si payload vide', async () => {
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({});
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCAN_ERROR',
      message: expect.stringContaining('inattendue'),
    }));
  });
});
