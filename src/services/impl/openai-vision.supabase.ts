// src/services/impl/openai-vision.supabase.ts — Edge Function analyzePerfumeImage
import i18next from 'i18next';
import { supabase } from '../supabase';
import type { ScanResult, ScanFailureReason, CollectionScanResult, CollectionDetection } from '../../models';
import { COLLECTION_MAX_DETECTIONS } from '../../utils/collection-scan';

// 120 s : pire cas serveur = 3 appels OpenAI bornés à 30 s (lecture + escalade + re-ranking ;
// en mode collection les re-ranks sont parallèles, le budget reste ≤ 90 s).
const CALL_TIMEOUT_MS = 120_000;

const FAILURE_REASONS: ScanFailureReason[] = ['none', 'blur', 'glare', 'label_unreadable', 'bad_framing', 'not_a_perfume'];

export async function analyzeImage(base64Image: string): Promise<ScanResult> {
  return callAnalyze({ imageBase64: base64Image });
}

export async function analyzeMultipleImages(imagesBase64: string[]): Promise<ScanResult> {
  return callAnalyze({ imagesBase64 });
}

// Mode collection : une photo d'étagère → inventaire de flacons (v6).
export async function analyzeCollectionImage(base64Image: string): Promise<CollectionScanResult> {
  const data = await invokeAnalyze({ imageBase64: base64Image, mode: 'collection' });
  if (data == null || typeof data !== 'object') {
    return { isCollection: false, estimatedCount: 0, bottles: [] };
  }
  const r = data as Partial<CollectionScanResult>;
  const bottles: CollectionDetection[] = (Array.isArray(r.bottles) ? r.bottles : [])
    .filter((b): b is CollectionDetection => !!b && typeof b === 'object')
    // Retour annoté : sans annotation, l'inférence TS à travers le .filter()
    // suivant élargit le ternaire littéral confidence en string.
    .map((b): CollectionDetection => ({
      textRead: b.textRead === true,
      marque: typeof b.marque === 'string' ? b.marque : null,
      nom: typeof b.nom === 'string' ? b.nom : null,
      typeParfum: typeof b.typeParfum === 'string' ? b.typeParfum : null,
      confidence: b.confidence === 'high' ? 'high' : 'low',
      alternatives: Array.isArray(b.alternatives) ? b.alternatives.filter((a) => typeof a === 'string').slice(0, 2) : [],
      visualMatch: b.visualMatch === true,
    }))
    .filter((b) => b.marque !== null || b.nom !== null)
    .slice(0, COLLECTION_MAX_DETECTIONS);
  const estimated = typeof r.estimatedCount === 'number' && Number.isFinite(r.estimatedCount)
    ? Math.round(Math.min(Math.max(r.estimatedCount, 0), 60))
    : bottles.length;
  return {
    isCollection: r.isCollection !== false && (bottles.length > 0 || estimated > 0),
    estimatedCount: Math.max(estimated, bottles.length),
    bottles,
  };
}

async function callAnalyze(payload: { imageBase64?: string; imagesBase64?: string[] }): Promise<ScanResult> {
  const data = await invokeAnalyze(payload);
  if (data == null || typeof data !== 'object') {
    return {
      marque: null, nom: null, volumeMl: null, typeParfum: null,
      confidence: 'low', alternatives: [], isPerfume: false, failureReason: 'none',
      textRead: false, visualMatch: false,
    };
  }
  const r = data as Partial<ScanResult>;
  return {
    ...r,
    marque: r.marque ?? null,
    nom: r.nom ?? null,
    volumeMl: typeof r.volumeMl === 'number' ? r.volumeMl : null,
    typeParfum: r.typeParfum ?? null,
    confidence: r.confidence ?? 'low',
    alternatives: r.alternatives ?? [],
    isPerfume: r.isPerfume !== false,
    failureReason: r.failureReason && FAILURE_REASONS.includes(r.failureReason) ? r.failureReason : 'none',
    // textRead : préserve l'indéterminé (undefined) si la fonction n'est pas encore
    // en v4 — absent → false ferait passer 100 % des scans en « Reconnu à la forme ».
    textRead: typeof r.textRead === 'boolean' ? r.textRead : undefined,
    visualMatch: r.visualMatch === true,
  };
}

// Invoke + timeout + mapping d'erreurs partagés entre scan unitaire et mode collection.
async function invokeAnalyze(payload: Record<string, unknown>): Promise<unknown> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error(i18next.t('scan.analysisTimeout')), { code: 'SCAN_TIMEOUT' })), CALL_TIMEOUT_MS),
    );
    const { data, error } = await Promise.race([
      supabase.functions.invoke('analyze-perfume-image', { body: payload }),
      timeoutPromise,
    ]);
    if (error) {
      const msg = await readErrorMsg(error, i18next.t('scan.analysisErrorShort'));
      throw new Error(msg);
    }
    return data;
  } catch (err: unknown) {
    const e = err as Error;
    if ((e as { code?: string }).code === 'SCAN_TIMEOUT') throw e;
    if (e.message?.includes('429') || e.message?.includes('quotidienne') || e.message?.includes('resource')) throw new Error(i18next.t('scan.quotaReached'));
    // Le body 401 de l'Edge Function est « Unauthorized. » (le message HTTP générique
    // de functions-js ne contient jamais « 401 ») — matcher aussi le statut si dispo.
    const status = (e as { context?: { status?: number } }).context?.status;
    if (status === 401 || e.message?.includes('401') || e.message?.includes('unauthenticated') || e.message?.includes('Unauthorized')) throw new Error(i18next.t('scan.analysisNeedsAuth'));
    if (e.message?.includes('not found') || e.message?.includes('indisponible')) throw new Error(i18next.t('scan.analysisUnavailable'));
    throw new Error(i18next.t('scan.analysisError'));
  }
}

async function readErrorMsg(error: unknown, fallback: string): Promise<string> {
  const e = error as { message?: string; context?: { json?: () => Promise<unknown> } };
  if (e.context?.json) {
    try {
      const body = await e.context.json() as { error?: string };
      if (body?.error) return body.error;
    } catch { /* ignore */ }
  }
  return e.message ?? fallback;
}
