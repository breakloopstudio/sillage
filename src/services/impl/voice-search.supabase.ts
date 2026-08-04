// src/services/impl/voice-search.supabase.ts — Pipeline voix « identification »
// Transcription (Edge Function transcribe-voice), interprétation structurée
// (Edge Function interpret-voice-query) et identification catalogue alignée sur
// le moteur du scan (searchParfumFromScan : nom exact / fuzzy / alias / concentration).
import * as FileSystem from 'expo-file-system';
import i18next from 'i18next';
import { supabase } from '../supabase';
import { searchParfumsCached, searchParfumFromScan } from './catalog.supabase';
import { normalize } from '../../utils/normalize';
import { deviceVoiceLanguages } from '../../utils/device-locale';
import type { Parfum } from '../../models';

// ─── Interprétation structurée (Edge Function interpret-voice-query) ───

export interface VoiceInterpretation {
  isPerfumeRequest: boolean;
  marque: string | null;
  nom: string | null;
  typeParfum: string | null;
  alternatives: string[];
  confidence: 'high' | 'low';
}

// 12 s : le serveur borne l'appel OpenAI à 20 s ; le client coupe avant pour
// rester sous le watchdog « searching » (35 s) des écrans voix.
const INTERPRET_TIMEOUT_MS = 12_000;
// 15 s : le serveur borne la transcription à 60 s ; le client coupe avant pour
// que la seconde chance (re-transcription) reste sous le watchdog des écrans voix.
const TRANSCRIBE_TIMEOUT_MS = 15_000;
const MAX_INTERPRET_TEXT = 500;

const TYPE_PARFUM_VALUES: readonly string[] = ['Parfum', 'Extrait', 'Eau de Parfum', 'Eau de Toilette', 'Eau de Cologne'];

/** Invoke Edge Function avec timeout client (timer nettoyé quoi qu'il arrive). */
async function invokeWithTimeout(
  fnName: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  timeoutMsg: string,
): Promise<{ data: unknown; error: unknown }> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(timeoutMsg), { code: 'VOICE_TIMEOUT' })), timeoutMs);
    });
    return await Promise.race([
      supabase.functions.invoke(fnName, { body }),
      timeoutPromise,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Mapping d'erreur partagé interpret/transcribe (status HTTP + body JSON + message). */
async function mapVoiceFunctionError(
  err: unknown,
  labels: { quota: string; auth: string; unavailable: string; fallback: string },
): Promise<Error> {
  const e = err as Error;
  if ((e as { code?: string }).code === 'VOICE_TIMEOUT') return e;
  const status = (e as { context?: { status?: number } }).context?.status;
  const bodyMsg = await readErrorMsg(e, '');
  if (status === 429 || bodyMsg.includes('quotidienne') || e.message?.includes('429') || e.message?.includes('quotidienne') || e.message?.includes('resource')) return new Error(labels.quota);
  if (status === 401 || bodyMsg.includes('Unauthorized') || e.message?.includes('401') || e.message?.includes('unauthenticated') || e.message?.includes('Unauthorized')) return new Error(labels.auth);
  if (e.message?.includes('not found') || e.message?.includes('indisponible')) return new Error(labels.unavailable);
  return new Error(labels.fallback);
}

export async function interpretVoiceQuery(
  text: string,
  alternatives?: string[],
): Promise<VoiceInterpretation> {
  const trimmed = text.trim();
  const seen = new Set<string>([trimmed.toLowerCase()]);
  const alts: string[] = [];
  for (const raw of alternatives ?? []) {
    const a = raw.trim();
    const key = a.toLowerCase();
    if (a.length === 0 || seen.has(key)) continue;
    seen.add(key);
    alts.push(a);
    if (alts.length >= 4) break;
  }
  try {
    const { data, error } = await invokeWithTimeout(
      'interpret-voice-query',
      { text: trimmed.slice(0, MAX_INTERPRET_TEXT), alternatives: alts },
      INTERPRET_TIMEOUT_MS,
      i18next.t('voice.interpretTimeout'),
    );
    if (error) {
      const msg = await readErrorMsg(error, i18next.t('voice.interpretFailed'));
      throw new Error(msg);
    }
    const r = (data ?? {}) as Partial<VoiceInterpretation>;
    const marque = typeof r.marque === 'string' && r.marque.trim() ? r.marque.trim() : null;
    const nom = typeof r.nom === 'string' && r.nom.trim() ? r.nom.trim() : null;
    return {
      isPerfumeRequest: r.isPerfumeRequest === true,
      marque,
      nom,
      typeParfum: typeof r.typeParfum === 'string' && TYPE_PARFUM_VALUES.includes(r.typeParfum) ? r.typeParfum : null,
      alternatives: Array.isArray(r.alternatives)
        ? r.alternatives.filter((a): a is string => typeof a === 'string' && a.trim().length > 0).slice(0, 2)
        : [],
      confidence: r.confidence === 'high' ? 'high' : 'low',
    };
  } catch (err: unknown) {
    throw await mapVoiceFunctionError(err, {
      quota: i18next.t('voice.quotaReached'),
      auth: i18next.t('voice.interpretNeedsAuth'),
      unavailable: i18next.t('voice.interpretUnavailable'),
      fallback: i18next.t('voice.interpretFailed'),
    });
  }
}

// ─── Transcription (Edge Function transcribe-voice) ───

export async function transcribeVoice(
  audioBase64: string,
  mimeType: string,
  languages: string[] = deviceVoiceLanguages(),
): Promise<string> {
  try {
    const { data, error } = await invokeWithTimeout(
      'transcribe-voice',
      { audioBase64, mimeType, languages },
      TRANSCRIBE_TIMEOUT_MS,
      i18next.t('voice.transcribeTimeout'),
    );
    if (error) {
      const msg = await readErrorMsg(error, i18next.t('voice.transcribeFailed'));
      throw new Error(msg);
    }
    if (!data || typeof (data as Record<string, unknown>).text !== 'string') {
      throw new Error(i18next.t('voice.transcribeEmpty'));
    }
    return (data as { text: string }).text;
  } catch (err: unknown) {
    throw await mapVoiceFunctionError(err, {
      quota: i18next.t('voice.quotaReached'),
      auth: i18next.t('voice.transcribeNeedsAuth'),
      unavailable: i18next.t('voice.transcribeUnavailable'),
      fallback: i18next.t('voice.transcribeFailed'),
    });
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

// ─── Décision d'auto-ouverture (alignée sur les seuils du scan) ───

// Score minimum du top résultat pour ouvrir la fiche directement :
// au moins nom exact (+50) + concentration (+12) OU nom exact (+50) + marque (+15).
export const VOICE_AUTO_OPEN_MIN_SCORE = 62;
// Écart minimum avec le n°2 quand plusieurs candidats sont présents.
export const VOICE_AUTO_OPEN_GAP = 10;

/** Décision d'auto-ouverture : uniquement sur la voie interprétée (score scan +
 *  confiance LLM haute) — jamais sur une recherche texte brute non rescoringée. */
export function pickAutoOpen(
  results: Array<Parfum & { _scanScore?: number }>,
  interpretation: VoiceInterpretation | null,
): Parfum | null {
  if (results.length === 0) return null;
  if (!interpretation || interpretation.confidence !== 'high') return null;
  const top = results[0];
  const topScore = top._scanScore;
  if (typeof topScore !== 'number') return null;
  if (topScore < VOICE_AUTO_OPEN_MIN_SCORE) return null;
  if (results.length > 1) {
    const secondScore = results[1]._scanScore ?? 0;
    if (topScore - secondScore < VOICE_AUTO_OPEN_GAP) return null;
  }
  return top;
}

/** Voie non connectée (pas d'interprétation LLM) : auto-ouverture uniquement si
 *  la requête est EXACTEMENT « marque + nom » ou « nom » du top résultat. */
export function exactQueryMatch(results: Parfum[], query: string): Parfum | null {
  if (results.length === 0) return null;
  const q = normalize(query);
  if (q.length < 3) return null;
  const top = results[0];
  const matches = (p: Parfum) => {
    const full = normalize(`${p.marque ?? ''} ${p.nom ?? ''}`);
    const nom = normalize(p.nom ?? '');
    return (full.length > 0 && q === full) || (nom.length > 0 && q === nom);
  };
  if (!matches(top)) return null;
  if (results.length > 1 && matches(results[1])) return null;
  return top;
}

// ─── Pipeline d'identification ───

export interface VoiceIdentifyOutcome {
  /** Résultats ordonnés (rescoring scan si interprétation, sinon recherche brute). */
  results: Parfum[];
  /** La requête résolue (le transcript transmis). */
  query: string;
  /** Match unique de haute confiance → ouvrir la fiche directement. */
  autoOpen: Parfum | null;
  /** true si l'interprétation LLM a alimenté searchParfumFromScan. */
  interpreted: boolean;
  /** Confiance de l'interprétation LLM (null si absente / en échec). */
  confidence: 'high' | 'low' | null;
  /** Requête spécifique selon le LLM (nom propre prononcé) ; null si pas d'interprétation. */
  specific: boolean | null;
  /** Score scan du top résultat (null si absent ou recherche non rescoringée). */
  topScore: number | null;
}

/** Seconde chance (re-transcription serveur) nécessaire quand le match est
 *  faible : 0 résultat, OU pas d'auto-ouverture sans interprétation confiante.
 *  Gate QUALITÉ (pas nombre de résultats) : le RPC trgm renvoie presque toujours
 *  « quelque chose » sur un transcript écorché — c'est la confiance du match qui
 *  doit décider. Une interprétation haute confiance avec des résultats est
 *  acceptée telle quelle (ex. requête marque seule) ; une requête explicitement
 *  vague aussi (pas de nom propre à récupérer). */
export function voiceNeedsSecondChance(outcome: VoiceIdentifyOutcome): boolean {
  if (outcome.autoOpen) return false;
  if (outcome.results.length === 0) return true;
  if (outcome.specific === false) return false;
  return outcome.confidence !== 'high';
}

/** Choisit le meilleur de deux aboutissements (1er passage vs re-transcription).
 *  autoOpen > résultats confiants > nombre de résultats. À auto-ouverture des
 *  deux côtés, la re-transcription serveur (vocabulaire enrichi) l'emporte. */
export function pickBetterVoiceOutcome(
  first: VoiceIdentifyOutcome,
  retry: VoiceIdentifyOutcome,
): VoiceIdentifyOutcome {
  if (retry.autoOpen) return retry;
  if (first.autoOpen) return first;
  const firstHigh = first.confidence === 'high' && first.results.length > 0;
  const retryHigh = retry.confidence === 'high' && retry.results.length > 0;
  if (retryHigh !== firstHigh) return retryHigh ? retry : first;
  return retry.results.length > first.results.length ? retry : first;
}

/** Pipeline voix : transcript (+ hypothèses alternatives du STT) → interprétation
 *  structurée (si connecté) → searchParfumFromScan → décision d'auto-ouverture.
 *  Dégrade gracieusement : interprétation en échec / absent → recherche texte brute. */
export async function identifyFromVoice(
  text: string,
  opts: { isAuthenticated: boolean; alternatives?: string[] },
): Promise<VoiceIdentifyOutcome> {
  const query = text.trim();

  let interpretation: VoiceInterpretation | null = null;
  if (opts.isAuthenticated) {
    try {
      interpretation = await interpretVoiceQuery(query, opts.alternatives);
    } catch (e: unknown) {
      if (__DEV__) console.warn('[voice] interpretation failed → fallback search:', (e as Error)?.message ?? String(e));
    }
  }

  if (interpretation && interpretation.isPerfumeRequest && (interpretation.marque || interpretation.nom)) {
    try {
      const scored = await searchParfumFromScan({
        marque: interpretation.marque,
        nom: interpretation.nom,
        typeParfum: interpretation.typeParfum,
        alternatives: interpretation.alternatives,
      });
      if (scored.length > 0) {
        return {
          results: scored,
          query,
          autoOpen: pickAutoOpen(scored, interpretation),
          interpreted: true,
          confidence: interpretation.confidence,
          specific: interpretation.isPerfumeRequest,
          topScore: typeof scored[0]._scanScore === 'number' ? scored[0]._scanScore : null,
        };
      }
    } catch (e: unknown) {
      if (__DEV__) console.warn('[voice] scan search failed → fallback search:', (e as Error)?.message ?? String(e));
    }
  }

  const results = await searchParfumsCached(query);
  return {
    results,
    query,
    autoOpen: exactQueryMatch(results, query),
    interpreted: false,
    confidence: interpretation ? interpretation.confidence : null,
    specific: interpretation ? interpretation.isPerfumeRequest : null,
    topScore: null,
  };
}

// ─── Audio (seconde chance Whisper) ───

const MIME_BY_EXT: Record<string, string> = {
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  webm: 'audio/webm',
  mp3: 'audio/mpeg',
};

/** MIME réel du fichier audio persisté (au lieu de 'audio/wav' hardcodé). */
export function mimeFromAudioUri(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'audio/wav';
}

/** Lecture base64 paresseuse de l'audio persisté (seconde chance Whisper). */
export async function readVoiceAudioBase64(uri: string): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return base64 && base64.length > 0 ? base64 : null;
  } catch (e: unknown) {
    console.warn('[voice] Failed to read audio file:', (e as Error)?.message ?? String(e));
    return null;
  }
}
