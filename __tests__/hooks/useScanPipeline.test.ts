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
    expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ marque: 'Dior', nom: 'Sauvage' }));
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
    expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ marque: 'Dior', nom: 'Sauvage' }));
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

  // ── Low confidence ────────────────────────────────────

  it('GPT low confidence + candidat solide → dispatch SCAN_SUCCESS (confidence low)', async () => {
    mockAnalyze.mockResolvedValue(makeResult({ confidence: 'low' }));
    mockSearch.mockResolvedValue([{ ...makeParfum(), _scanScore: 65 }]);
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ images: ['img1'] });
    });
    expect(mockSearch).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCAN_SUCCESS',
      confidence: 'low',
    }));
  });

  it('GPT low confidence + score pile au seuil (50) → résultats affichés', async () => {
    mockAnalyze.mockResolvedValue(makeResult({ confidence: 'low' }));
    mockSearch.mockResolvedValue([{ ...makeParfum(), _scanScore: 50 }]);
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ images: ['img1'] });
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SCAN_SUCCESS', confidence: 'low' }));
  });

  it('GPT low confidence + candidat faible → dispatch SCAN_CLARIFY low-confidence', async () => {
    mockAnalyze.mockResolvedValue(makeResult({ confidence: 'low' }));
    mockSearch.mockResolvedValue([{ ...makeParfum(), _scanScore: 30 }]);
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ images: ['img1'] });
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCAN_CLARIFY',
      reason: 'low-confidence',
    }));
    expect(mockHapticsSuccess).not.toHaveBeenCalled();
  });

  it('GPT low confidence + 0 résultat → dispatch SCAN_CLARIFY low-confidence', async () => {
    mockAnalyze.mockResolvedValue(makeResult({ confidence: 'low' }));
    mockSearch.mockResolvedValue([]);
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ images: ['img1'] });
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCAN_CLARIFY',
      reason: 'low-confidence',
    }));
  });

  it('GPT sans marque/nom mais avec alternatives → cherche (pas de clarify)', async () => {
    mockAnalyze.mockResolvedValue(makeResult({ marque: null, nom: null, alternatives: ['Sauvage'] }));
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ images: ['img1'] });
    });
    expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({ alternatives: ['Sauvage'] }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SCAN_SUCCESS' }));
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

  it("image hors-sujet (isPerfume false) → dispatch SCAN_CLARIFY empty-response sans chercher", async () => {
    mockAnalyze.mockResolvedValue(makeResult({ isPerfume: false, failureReason: 'not_a_perfume', marque: null, nom: null }));
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ images: ['img1'] });
    });
    expect(mockSearch).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCAN_CLARIFY',
      reason: 'empty-response',
    }));
  });

  // ── Lecture brute transmise à l'écran de résultats ───

  it('SCAN_SUCCESS porte la lecture IA (read) pour un scan image', async () => {
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ images: ['img1'] });
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCAN_SUCCESS',
      read: expect.objectContaining({ marque: 'Dior', nom: 'Sauvage' }),
    }));
  });

  it('v4 : forme + re-ranking confiant → SCAN_SUCCESS sans clarify', async () => {
    mockAnalyze.mockResolvedValue(makeResult({ confidence: 'high', textRead: false, visualMatch: true }));
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ images: ['img1'] });
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCAN_SUCCESS',
      confidence: 'high',
      read: expect.objectContaining({ textRead: false, visualMatch: true }),
    }));
  });

  it('SCAN_SUCCESS porte read=null pour une saisie clarify', async () => {
    const { dispatch, result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ scanResult: makeResult() });
    });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCAN_SUCCESS',
      read: null,
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

  it('rawText persiste la lecture complète (volumeMl + confidence)', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.startAnalysis({ scanResult: makeResult({ volumeMl: 75 }) });
    });
    const call = mockSaveScan.mock.calls[0][1] as { rawText: string };
    expect(JSON.parse(call.rawText)).toEqual({
      marque: 'Dior', nom: 'Sauvage', typeParfum: 'EDT', volumeMl: 75,
      confidence: 'high', textRead: null, visualMatch: null,
    });
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

  it('ne dispatch pas après unmount (garde mountedRef)', async () => {
    const dispatch = jest.fn();
    const mountedRef = { current: true };
    const { result, unmount } = renderHook(() => useScanPipeline(dispatch, 'test-uid', mountedRef));

    // L'analyse résout un résultat VALIDE (pas de TypeError masquant la garde).
    let resolve: (r: ScanResult) => void;
    mockAnalyze.mockImplementation(() => new Promise<ScanResult>(r => { resolve = r; }));

    const p = act(() => {
      void result.current.startAnalysis({ images: ['img1'] });
      return new Promise(r => setTimeout(r, 0));
    });
    await p;

    // Unmount avant la fin de l'analyse — ScanScreen pose mountedRef.current = false.
    unmount();
    mountedRef.current = false;

    // Résoudre l'analyse : la garde mountedRef doit bloquer tout dispatch ultérieur.
    resolve!(makeResult());
    await new Promise(r => setTimeout(r, 0));

    // Seul START_SCAN est passé avant l'unmount ; rien après.
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'START_SCAN' }));
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
