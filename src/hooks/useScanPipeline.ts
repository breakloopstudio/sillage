// src/hooks/useScanPipeline.ts — Pipeline analyse → recherche → résultats
// Testable : mock des services, dispatch capturé

import { useRef, useCallback } from 'react';
import type { ScanAction } from './useScanReducer';
import type { ScanResult, Parfum } from '../models';
import { analyzeImage, analyzeMultipleImages } from '../services/openai-vision';
import { searchParfumFromScan } from '../services/catalog';
import { saveScan } from '../services/user-data';
import { hapticsSuccess, hapticsError } from '../services/haptics';

const MIN_ANIMATION_MS = 400;

export function useScanPipeline(
  dispatch: React.Dispatch<ScanAction>,
  uid: string | null,
  mountedRef: React.MutableRefObject<boolean>,
) {
  const inProgressRef = useRef(false);
  const scanIdRef = useRef(0);

  // ── Helpers internes ──────────────────────────────────

  async function searchAndShow(scanResult: ScanResult, scanId: number) {
    try {
      const parfums = await searchParfumFromScan(scanResult);
      if (!mountedRef.current || scanIdRef.current !== scanId) return;

      if (parfums.length > 0) {
        hapticsSuccess();
        if (uid) {
          const top = parfums[0];
          saveScan(uid, {
            rawText: JSON.stringify({ marque: scanResult.marque, nom: scanResult.nom, typeParfum: scanResult.typeParfum }),
            marque: top?.marque ?? scanResult.marque ?? undefined,
            nom: top?.nom ?? scanResult.nom ?? undefined,
            typeParfum: scanResult.typeParfum ?? undefined,
            parfumId: top?.id,
            imageUrl: top?.imageUrl,
            familleOlactive: top?.familleOlactive,
            annee: top?.annee,
            bestPrice: top?.bestPrice,
            status: 'success',
          }).catch(() => {});
        }
        if (mountedRef.current && scanIdRef.current === scanId) {
          dispatch({ type: 'SCAN_SUCCESS', parfums, confidence: scanResult.confidence });
        }
      } else {
        if (uid) {
          saveScan(uid, {
            rawText: JSON.stringify({ marque: scanResult.marque, nom: scanResult.nom, typeParfum: scanResult.typeParfum }),
            marque: scanResult.marque ?? undefined,
            nom: scanResult.nom ?? undefined,
            typeParfum: scanResult.typeParfum ?? undefined,
            status: 'no-result',
          }).catch(() => {});
        }
        if (mountedRef.current && scanIdRef.current === scanId) {
          dispatch({ type: 'SCAN_NO_RESULT', scanResult });
        }
      }
    } catch (e) {
      console.warn('[scan] search failed:', e);
      if (uid) {
        saveScan(uid, {
          rawText: JSON.stringify(scanResult),
          marque: scanResult.marque ?? undefined,
          nom: scanResult.nom ?? undefined,
          status: 'error',
        }).catch(() => {});
      }
      if (mountedRef.current && scanIdRef.current === scanId) {
        dispatch({ type: 'SCAN_ERROR', message: 'Connexion impossible. Vérifiez votre réseau.' });
        hapticsError();
      }
    }
  }

  async function clarifyOrSearch(result: ScanResult, scanId: number) {
    const hasSomething = result.marque || result.nom || (result.alternatives && result.alternatives.length > 0);
    if (!hasSomething) {
      if (mountedRef.current && scanIdRef.current === scanId) {
        dispatch({ type: 'SCAN_CLARIFY', scanResult: result, reason: 'empty-response' });
      }
      return;
    }
    // Même en low-confidence on cherche : résultats + alternatives proposent des candidats,
    // l'écran de résultats s'adapte (« Est-ce l'un de ces parfums ? »). Clarify = dernier recours.
    await searchAndShow(result, scanId);
  }

  async function runBurstAnalysis(images: string[], scanId: number) {
    if (images.length >= 2) {
      const result = await analyzeMultipleImages(images);
      await clarifyOrSearch(result, scanId);
    } else {
      const result = await analyzeImage(images[0]);
      await clarifyOrSearch(result, scanId);
    }
  }

  // ── Point d'entrée ────────────────────────────────────

  const startAnalysis = useCallback(async (payload: { images?: string[]; scanResult?: ScanResult }) => {
    if (inProgressRef.current) return;
    inProgressRef.current = true;

    const scanId = ++scanIdRef.current;

    dispatch({ type: 'START_SCAN', images: payload.images, scanResult: payload.scanResult });

    const started = Date.now();

    try {
      if (payload.images && payload.images.length > 0) {
        await runBurstAnalysis(payload.images, scanId);
      } else if (payload.scanResult) {
        await searchAndShow(payload.scanResult, scanId);
      } else {
        if (mountedRef.current && scanIdRef.current === scanId) {
          dispatch({ type: 'SCAN_ERROR', message: 'Une erreur inattendue est survenue. Veuillez réessayer.' });
          hapticsError();
        }
        if (scanIdRef.current === scanId) inProgressRef.current = false;
        return;
      }
    } catch (e: unknown) {
      console.warn('[scan] analysis failed:', e);
      if (mountedRef.current && scanIdRef.current === scanId) {
        dispatch({
          type: 'SCAN_ERROR',
          message: e instanceof Error ? e.message : 'Échec de l\'analyse. Veuillez réessayer.',
        });
        hapticsError();
      }
      if (scanIdRef.current === scanId) inProgressRef.current = false;
      return;
    }

    if (scanIdRef.current !== scanId) return;

    const elapsed = Date.now() - started;
    if (elapsed < MIN_ANIMATION_MS) {
      await new Promise(r => setTimeout(r, MIN_ANIMATION_MS - elapsed));
    }

    if (scanIdRef.current === scanId) inProgressRef.current = false;
  }, [dispatch, uid, mountedRef]);

  const cancelAnalysis = useCallback(() => {
    scanIdRef.current++;
    inProgressRef.current = false;
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  return { startAnalysis, cancelAnalysis };
}
