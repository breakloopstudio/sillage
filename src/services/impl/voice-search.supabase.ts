// src/services/impl/voice-search.supabase.ts — Edge Function transcribeVoice
import { supabase } from '../supabase';

export async function transcribeVoice(audioBase64: string, mimeType: string): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('transcribe-voice', {
      body: { audioBase64, mimeType },
    });
    if (error) {
      const msg = error.message ?? 'Échec de la transcription vocale.';
      throw new Error(msg);
    }
    if (!data || typeof (data as Record<string, unknown>).text !== 'string') {
      throw new Error('Réponse vide du service de transcription.');
    }
    return (data as { text: string }).text;
  } catch (err: unknown) {
    const e = err as Error;
    if (e.message?.includes('not found') || e.message?.includes('indisponible')) throw new Error('Service de transcription indisponible.');
    if (e.message?.includes('429') || e.message?.includes('quotidienne')) throw new Error('Limite quotidienne de transcriptions atteinte.');
    if (e.message?.includes('401') || e.message?.includes('unauthenticated')) throw new Error('Connexion requise pour la transcription vocale.');
    throw new Error('Échec de la transcription vocale.');
  }
}
