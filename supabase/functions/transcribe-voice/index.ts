// Supabase Edge Function: transcribe-voice
// OpenAI Whisper — transcription audio. Port du code Firebase.
// Appelée par le client voice-search.ts (supabase.functions.invoke).

import OpenAI from 'npm:openai';
import { createUserClient, verifyUserToken } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let uid: string;
  try { ({ uid } = await verifyUserToken(req)); } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createUserClient(authHeader);

  // Rate limit
  const { error: rateErr } = await supabase.rpc('check_and_increment_quota', { p_kind: 'voice', p_max: 60 });
  if (rateErr) {
    return new Response(JSON.stringify({ error: 'Limite quotidienne atteinte (voice).' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  let body: { audioBase64: string; mimeType: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'JSON invalide.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

  const { audioBase64, mimeType } = body;
  if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
    return new Response(JSON.stringify({ error: 'audioBase64 requis.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  if (typeof mimeType !== 'string' || mimeType.length === 0) {
    return new Response(JSON.stringify({ error: 'mimeType requis.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const ALLOWED_MIME = ['audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/webm', 'audio/mpeg'];
  if (!ALLOWED_MIME.includes(mimeType)) {
    return new Response(JSON.stringify({ error: 'Format audio non supporté.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Limite 10 Mo (parité Firebase) — base64 ≈ 1.37× la taille binaire
  const MAX_B64 = 10 * 1024 * 1024 * 1.37;
  if (audioBase64.length > MAX_B64) {
    return new Response(JSON.stringify({ error: 'Fichier audio trop volumineux (max 10 Mo).' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'Clé API OpenAI non configurée.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const openai = new OpenAI({ apiKey, timeout: 60_000 });
  let buffer: Uint8Array;
  try {
    buffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
  } catch {
    return new Response(JSON.stringify({ error: 'Audio base64 invalide.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const ext = mimeType === 'audio/wav' ? '.wav' : mimeType === 'audio/mp4' ? '.m4a' : '.audio';
  const file = new File([buffer], `audio${ext}`, { type: mimeType });

  try {
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1', file, response_format: 'text', language: 'fr',
      prompt: 'Dior, Chanel, Guerlain, Yves Saint Laurent, Lancôme, Hermès, Jean Paul Gaultier, Paco Rabanne, Givenchy, Versace, Armani, Tom Ford, Calvin Klein, Hugo Boss, Burberry, Dolce & Gabbana, Bvlgari, Creed, Le Labo, Byredo, Diptyque, Maison Margiela, Prada, Valentino, Azzaro, Kenzo, Mugler, Cartier, Cacharel, Lalique, Acqua di Parma, Maison Francis Kurkdjian, Xerjoff, Parfums de Marly, Amouage, By Kilian, Initio',
    });
    console.log('[transcribeVoice] User:', uid, 'Transcription OK');
    return new Response(JSON.stringify({ text: transcription }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    console.error('[transcribeVoice]', (e as Error)?.message ?? String(e));
    return new Response(JSON.stringify({ error: 'Échec de la transcription vocale.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
