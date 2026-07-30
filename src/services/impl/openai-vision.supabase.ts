// src/services/impl/openai-vision.supabase.ts — Edge Function analyzePerfumeImage
import { supabase } from '../supabase';
import type { ScanResult } from '../../models';

const CALL_TIMEOUT_MS = 90_000;

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
      return { marque: null, nom: null, volumeMl: null, typeParfum: null, confidence: 'low', alternatives: [] } as unknown as ScanResult;
    }
    return data as ScanResult;
  } catch (err: unknown) {
    const e = err as Error;
    if (e.message?.includes("Délai d'analyse")) throw e;
    if (e.message?.includes('429') || e.message?.includes('quotidienne') || e.message?.includes('resource')) throw new Error('Limite quotidienne de scans atteinte. Réessayez demain.');
    if (e.message?.includes('401') || e.message?.includes('unauthenticated')) throw new Error('Connexion requise pour analyser une image.');
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
