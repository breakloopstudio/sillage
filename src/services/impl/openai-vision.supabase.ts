// src/services/impl/openai-vision.supabase.ts — Edge Function analyzePerfumeImage
import { supabase } from '../supabase';
import type { ScanResult, ScanFailureReason } from '../../models';

// 120 s : pire cas serveur v4 = 3 appels OpenAI bornés à 30 s (lecture + escalade + re-ranking).
const CALL_TIMEOUT_MS = 120_000;

const FAILURE_REASONS: ScanFailureReason[] = ['none', 'blur', 'glare', 'label_unreadable', 'bad_framing', 'not_a_perfume'];

export async function analyzeImage(base64Image: string): Promise<ScanResult> {
  return callAnalyze({ imageBase64: base64Image });
}

export async function analyzeMultipleImages(imagesBase64: string[]): Promise<ScanResult> {
  return callAnalyze({ imagesBase64 });
}

async function callAnalyze(payload: { imageBase64?: string; imagesBase64?: string[] }): Promise<ScanResult> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Délai d'analyse dépassé. Vérifiez votre connexion.")), CALL_TIMEOUT_MS),
    );
    const { data, error } = await Promise.race([
      supabase.functions.invoke('analyze-perfume-image', { body: payload }),
      timeoutPromise,
    ]);
    if (error) {
      const msg = await readErrorMsg(error, "Échec de l'analyse IA.");
      throw new Error(msg);
    }
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
  } catch (err: unknown) {
    const e = err as Error;
    if (e.message?.includes("Délai d'analyse")) throw e;
    if (e.message?.includes('429') || e.message?.includes('quotidienne') || e.message?.includes('resource')) throw new Error('Limite quotidienne de scans atteinte. Réessayez demain.');
    // Le body 401 de l'Edge Function est « Unauthorized. » (le message HTTP générique
    // de functions-js ne contient jamais « 401 ») — matcher aussi le statut si dispo.
    const status = (e as { context?: { status?: number } }).context?.status;
    if (status === 401 || e.message?.includes('401') || e.message?.includes('unauthenticated') || e.message?.includes('Unauthorized')) throw new Error('Connexion requise pour analyser une image.');
    if (e.message?.includes('not found') || e.message?.includes('indisponible')) throw new Error("Service d'analyse IA indisponible.");
    throw new Error("Échec de l'analyse IA. Veuillez réessayer.");
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
