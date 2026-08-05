// src/hooks/useScanPipeline.ts — Pipeline analyse → recherche → résultats
// Testable : mock des services, dispatch capturé

import { useRef, useCallback } from 'react';
import i18next from 'i18next';
import type { ScanAction } from './useScanReducer';
import type { ScanResult, Parfum, CollectionMatch } from '../models';
import { analyzeImage, analyzeMultipleImages, analyzeCollectionImage } from '../services/openai-vision';
import { searchParfumFromScan } from '../services/catalog';
import { saveScan } from '../services/user-data';
import { hapticsSuccess, hapticsError } from '../services/haptics';
import {
  pickDetectionMatch, isMatchableDetection, dedupeCollectionMatches, COLLECTION_MAX_DETECTIONS,
} from '../utils/collection-scan';

const MIN_ANIMATION_MS = 400;
// Lecture incertaine + aucun candidat au-dessus de ce score → saisie assistée.
const CLARIFY_SCORE_THRESHOLD = 50;
// Mode collection : taille des lots de matching catalogue (parallélisme borné).
const SEARCH_BATCH_SIZE = 6;

/** Historique : lecture IA complète (volume + confiance + source inclus), schéma unique. */
function rawTextOf(r: ScanResult): string {
  return JSON.stringify({
    marque: r.marque, nom: r.nom, typeParfum: r.typeParfum,
    volumeMl: r.volumeMl, confidence: r.confidence ?? null,
    textRead: r.textRead ?? null, visualMatch: r.visualMatch ?? null,
  });
}

export function useScanPipeline(
  dispatch: React.Dispatch<ScanAction>,
  uid: string | null,
  mountedRef: React.MutableRefObject<boolean>,
) {
  const inProgressRef = useRef(false);
  const scanIdRef = useRef(0);

  // ── Helpers internes ──────────────────────────────────

  async function searchAndShow(scanResult: ScanResult, scanId: number, fromVision: boolean) {
    try {
      const parfums = await searchParfumFromScan(scanResult);
      if (!mountedRef.current || scanIdRef.current !== scanId) return;

      // Lecture incertaine + aucun candidat solide → clarify pré-rempli plutôt
      // qu'un match faible affiché comme une certitude.
      const topScore = parfums[0]?._scanScore ?? 0;
      if (scanResult.confidence === 'low' && (parfums.length === 0 || topScore < CLARIFY_SCORE_THRESHOLD)) {
        dispatch({ type: 'SCAN_CLARIFY', scanResult, reason: 'low-confidence' });
        return;
      }

      if (parfums.length > 0) {
        hapticsSuccess();
        if (uid) {
          const top = parfums[0];
          saveScan(uid, {
            rawText: rawTextOf(scanResult),
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
          dispatch({ type: 'SCAN_SUCCESS', parfums, confidence: scanResult.confidence, read: fromVision ? scanResult : null });
        }
      } else {
        if (uid) {
          saveScan(uid, {
            rawText: rawTextOf(scanResult),
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
          rawText: rawTextOf(scanResult),
          marque: scanResult.marque ?? undefined,
          nom: scanResult.nom ?? undefined,
          status: 'error',
        }).catch(() => {});
      }
      if (mountedRef.current && scanIdRef.current === scanId) {
        dispatch({ type: 'SCAN_ERROR', message: i18next.t('scan.errorNetwork') });
        hapticsError();
      }
    }
  }

  async function clarifyOrSearch(result: ScanResult, scanId: number) {
    const hasSomething = result.marque || result.nom || (result.alternatives && result.alternatives.length > 0);
    // Image hors-sujet (pas un flacon) ou rien de lisible → saisie assistée directe.
    if (result.isPerfume === false || !hasSomething) {
      if (mountedRef.current && scanIdRef.current === scanId) {
        dispatch({ type: 'SCAN_CLARIFY', scanResult: result, reason: 'empty-response' });
      }
      return;
    }
    // Même en low-confidence on cherche : résultats + alternatives proposent des candidats,
    // l'écran de résultats s'adapte (« Correspondance probable »). Clarify = dernier recours
    // (déclenché dans searchAndShow si aucun candidat solide).
    await searchAndShow(result, scanId, true);
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

  // ── Mode collection : inventaire multi-flacons ────────

  async function runCollectionAnalysis(images: string[], scanId: number) {
    const result = await analyzeCollectionImage(images);
    if (!mountedRef.current || scanIdRef.current !== scanId) return;

    const detections = result.bottles.filter(isMatchableDetection).slice(0, COLLECTION_MAX_DETECTIONS);
    if (!result.isCollection || detections.length === 0) {
      dispatch({ type: 'SCAN_ERROR', message: i18next.t('scan.collectionNoneIdentified') });
      hapticsError();
      return;
    }

    // Matching catalogue par détection (rescoring fuzzy partagé avec le scan unitaire).
    // Parallélisme BORNÉ par lots de 6 : 24 détections × (requête principale +
    // alternatives) satureraient la RPC search_parfums depuis un seul appareil.
    const settled: Array<PromiseSettledResult<Parfum[]>> = [];
    for (let i = 0; i < detections.length; i += SEARCH_BATCH_SIZE) {
      const batch = detections.slice(i, i + SEARCH_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((d) => searchParfumFromScan({
          marque: d.marque, nom: d.nom, alternatives: d.alternatives, typeParfum: d.typeParfum,
        })),
      );
      settled.push(...results);
      if (!mountedRef.current || scanIdRef.current !== scanId) return;
    }

    const rawMatches: CollectionMatch[] = [];
    settled.forEach((r, i) => {
      if (r.status !== 'fulfilled') return;
      const d = detections[i];
      const top = pickDetectionMatch(r.value);
      if (!top) return;
      rawMatches.push({
        parfum: top,
        confidence: d.confidence,
        textRead: d.textRead,
        visualMatch: d.visualMatch === true,
      });
    });

    const matches = dedupeCollectionMatches(rawMatches);
    if (matches.length === 0) {
      dispatch({ type: 'SCAN_ERROR', message: i18next.t('scan.collectionNoneIdentified') });
      hapticsError();
      return;
    }

    hapticsSuccess();
    dispatch({
      type: 'COLLECTION_SCAN_SUCCESS',
      matches,
      estimatedCount: Math.max(result.estimatedCount, matches.length),
    });
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
        // Saisie manuelle/clarify : pas de lecture IA → read null sur l'écran de résultats.
        await searchAndShow(payload.scanResult, scanId, false);
      } else {
        if (mountedRef.current && scanIdRef.current === scanId) {
          dispatch({ type: 'SCAN_ERROR', message: i18next.t('scan.errorUnexpected') });
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
          message: e instanceof Error ? e.message : i18next.t('scan.analysisFailed'),
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

  const startCollectionAnalysis = useCallback(async (payload: { images: string[] }) => {
    if (inProgressRef.current) return;
    inProgressRef.current = true;

    const scanId = ++scanIdRef.current;

    dispatch({ type: 'START_SCAN', images: payload.images });

    const started = Date.now();

    try {
      await runCollectionAnalysis(payload.images, scanId);
    } catch (e: unknown) {
      console.warn('[scan] collection analysis failed:', e);
      if (mountedRef.current && scanIdRef.current === scanId) {
        dispatch({
          type: 'SCAN_ERROR',
          message: e instanceof Error ? e.message : i18next.t('scan.analysisFailed'),
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
  }, [dispatch, mountedRef]);

  const cancelAnalysis = useCallback(() => {
    scanIdRef.current++;
    inProgressRef.current = false;
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  return { startAnalysis, startCollectionAnalysis, cancelAnalysis };
}
