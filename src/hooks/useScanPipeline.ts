// src/hooks/useScanPipeline.ts — Pipeline analyse → recherche → résultats
// Testable : mock des services, dispatch capturé

import { useRef, useCallback } from 'react';
import type { ScanAction } from './useScanReducer';
import type { ScanResult, Parfum } from '../models';
import { analyzeImage, analyzeMultipleImages } from '../services/openai-vision';
import { searchParfumFromScan } from '../services/firestore';
import { saveScan } from '../services/user-data';
import { hapticsSuccess, hapticsError } from '../services/haptics';

const MIN_ANIMATION_MS = 1200;

export function useScanPipeline(
  dispatch: React.Dispatch<ScanAction>,
  uid: string | null,
  mountedRef: React.MutableRefObject<boolean>,
) {
  const inProgressRef = useRef(false);

  // ── Helpers internes ──────────────────────────────────

  async function searchAndShow(scanResult: ScanResult) {
    try {
      const parfums = await searchParfumFromScan(scanResult.marque, scanResult.nom);
      if (!mountedRef.current) return;

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
        if (mountedRef.current) {
          dispatch({ type: 'SCAN_SUCCESS', parfums });
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
        if (mountedRef.current) {
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
      if (mountedRef.current) {
        dispatch({ type: 'SCAN_ERROR', message: 'Connexion impossible. Vérifiez votre réseau.' });
        hapticsError();
      }
    }
  }

  async function clarifyOrSearch(result: ScanResult) {
    if (!result.marque && !result.nom) {
      if (mountedRef.current) {
        dispatch({ type: 'SCAN_CLARIFY', scanResult: result, reason: 'empty-response' });
      }
      return;
    }
    if (result.confidence === 'low') {
      if (mountedRef.current) {
        dispatch({ type: 'SCAN_CLARIFY', scanResult: result, reason: 'low-confidence' });
      }
      return;
    }
    await searchAndShow(result);
  }

  async function runBurstAnalysis(images: string[]) {
    if (images.length >= 2) {
      const result = await analyzeMultipleImages(images);
      await clarifyOrSearch(result);
    } else {
      const result = await analyzeImage(images[0]);
      await clarifyOrSearch(result);
    }
  }

  // ── Point d'entrée ────────────────────────────────────

  const startAnalysis = useCallback(async (payload: { images?: string[]; scanResult?: ScanResult }) => {
    if (inProgressRef.current) return;
    inProgressRef.current = true;

    dispatch({ type: 'START_SCAN', images: payload.images, scanResult: payload.scanResult });

    const started = Date.now();

    try {
      if (payload.images && payload.images.length > 0) {
        await runBurstAnalysis(payload.images);
      } else if (payload.scanResult) {
        await searchAndShow(payload.scanResult);
      } else {
        if (mountedRef.current) {
          dispatch({ type: 'SCAN_ERROR', message: 'Une erreur inattendue est survenue. Veuillez réessayer.' });
          hapticsError();
        }
        inProgressRef.current = false;
        return;
      }
    } catch (e: unknown) {
      console.warn('[scan] analysis failed:', e);
      if (mountedRef.current) {
        dispatch({
          type: 'SCAN_ERROR',
          message: e instanceof Error ? e.message : 'Échec de l\'analyse. Veuillez réessayer.',
        });
        hapticsError();
      }
      inProgressRef.current = false;
      return;
    }

    const elapsed = Date.now() - started;
    if (elapsed < MIN_ANIMATION_MS) {
      await new Promise(r => setTimeout(r, MIN_ANIMATION_MS - elapsed));
    }

    inProgressRef.current = false;
  }, [dispatch, uid, mountedRef]);

  return { startAnalysis };
}
