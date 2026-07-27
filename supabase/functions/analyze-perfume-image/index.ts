// Supabase Edge Function: analyze-perfume-image
// GPT-4o Vision — analyse d'image de flacon. Port du code Firebase (functions/src/index.ts),
// prompts et logique de retry conservés à l'identique.

import OpenAI from 'npm:openai';
import { createUserClient, verifyUserToken } from '../_shared/supabase.ts';

interface ScanResult {
  marque: string | null;
  nom: string | null;
  volumeMl: number | null;
  typeParfum: string | null;
  confidence: 'high' | 'low';
}

/** Extrait un objet JSON d'une chaîne (supporte markdown fences et texte autour). */
function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text.trim();
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let uid: string;
  try { ({ uid } = await verifyUserToken(req)); } catch {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createUserClient(authHeader);

  // Rate limit — RPC atomique (UPDATE conditionnel, utilise auth.uid() du JWT)
  const { error: rateErr } = await supabase.rpc('check_and_increment_quota', { p_kind: 'scan', p_max: 30 });
  if (rateErr) {
    return jsonResponse({ error: 'Limite quotidienne atteinte (scan).' }, 429);
  }

  let body: { imageBase64?: string; imagesBase64?: string[] };
  try { body = await req.json(); } catch { return jsonResponse({ error: 'JSON invalide.' }, 400); }

  const { imageBase64, imagesBase64 } = body;
  const isBurst = Array.isArray(imagesBase64) && imagesBase64.length > 0;
  const hasSingle = typeof imageBase64 === 'string' && imageBase64.length > 0;
  if (!isBurst && !hasSingle) {
    return jsonResponse({ error: 'Le paramètre "imageBase64" ou "imagesBase64" est requis.' }, 400);
  }

  const images: string[] = isBurst ? imagesBase64! : [imageBase64!];
  if (images.length > 5) {
    return jsonResponse({ error: 'Maximum 5 images par requête.' }, 400);
  }
  const MAX_IMG_B64 = 5 * 1024 * 1024;
  const MIME_OK = /^data:image\/(jpeg|jpg|png|webp)/;
  for (const img of images) {
    if (typeof img !== 'string' || !MIME_OK.test(img)) {
      return jsonResponse({ error: 'Chaque image doit être en base64 (JPEG, PNG ou WebP).' }, 400);
    }
    if (img.length > MAX_IMG_B64) {
      return jsonResponse({ error: 'Image trop volumineuse (max 5 Mo par image).' }, 400);
    }
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return jsonResponse({ error: 'Clé API OpenAI non configurée.' }, 500);

  const openai = new OpenAI({ apiKey, timeout: 90_000 });

  // Prompts VERBATIM du code Firebase — ne pas raccourcir (qualité du scan)
  const BURST_PROMPT = `Tu es un expert en parfumerie. Tu analyses ${images.length} photos du MÊME flacon de parfum prises sous des angles légèrement différents. Analyse chaque photo indépendamment puis fusionne les lectures en un résultat unique. Retourne UNIQUEMENT un objet JSON avec ces champs :

- marque: la marque (ex: "Dior", "Chanel", "Xerjoff").
- nom: le nom du parfum (ex: "Sauvage", "N°5").
- volumeMl: le volume en ml (ex: 100). null si non visible sur aucune photo.
- typeParfum: "Eau de Parfum", "Eau de Toilette", "Extrait", "Parfum", ou null.
- confidence: "high" si clairement lisibles sur au moins 2 photos, "low" si incertain.

RÈGLES :
- Si les photos montrent des informations partielles ou contradictoires, utilise la photo la plus nette comme référence principale.
- Si un champ est partiellement visible, donne ta meilleure estimation, mets confidence:"low".
- N'invente JAMAIS volumeMl ou typeParfum si rien n'est visible (mets null).
- Réponds TOUJOURS avec un JSON valide contenant les 5 champs.
- Réponds uniquement avec le JSON, pas de texte autour.`;

  const SINGLE_PROMPT = `Tu es un expert en parfumerie. Analyse cette photo de flacon et retourne UNIQUEMENT un objet JSON avec ces champs :

- marque: la marque (ex: "Dior", "Chanel", "Xerjoff").
- nom: le nom du parfum (ex: "Sauvage", "N°5").
- volumeMl: le volume en ml (ex: 100). null si non visible.
- typeParfum: "Eau de Parfum", "Eau de Toilette", "Extrait", "Parfum", ou null.
- confidence: "high" si clairement lisibles, "low" si incertain.

RÈGLES :
- Si partiellement visible, donne ta meilleure estimation, mets confidence:"low".
- N'invente JAMAIS volumeMl ou typeParfum si rien n'est visible (mets null).
- Réponds TOUJOURS avec un JSON valide contenant les 5 champs.
- Réponds uniquement avec le JSON, pas de texte autour.`;

  const SYSTEM_PROMPT = isBurst ? BURST_PROMPT : SINGLE_PROMPT;

  const callOpenAI = (detail: 'auto' | 'high') => openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: SYSTEM_PROMPT },
          ...images.map(img => ({ type: 'image_url' as const, image_url: { url: img, detail } })),
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const parseResponse = (content: string | null, finishReason: string | null): ScanResult => {
    if (!content || content.trim().length === 0) {
      console.error('[analyzePerfumeImage] Empty content, finish_reason:', finishReason);
      throw new Error("Réponse vide de l'IA.");
    }
    const jsonStr = extractJson(content);
    console.log('[analyzePerfumeImage] Parsed JSON length:', jsonStr.length);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('[analyzePerfumeImage] JSON parse error. Raw (300 chars):', content.slice(0, 300));
      throw new Error("Réponse de l'IA invalide. Réessayez.");
    }
    return {
      marque: typeof parsed.marque === 'string' ? parsed.marque : null,
      nom: typeof parsed.nom === 'string' ? parsed.nom : null,
      volumeMl: typeof parsed.volumeMl === 'number' ? parsed.volumeMl : null,
      typeParfum: typeof parsed.typeParfum === 'string' ? parsed.typeParfum : null,
      confidence: parsed.confidence === 'high' || parsed.confidence === 'low' ? parsed.confidence : 'low',
    };
  };

  try {
    // Tentative 1 (detail: auto)
    const r1 = await callOpenAI('auto');
    console.log(`[analyzePerfumeImage] ${isBurst ? `Burst (${images.length})` : 'Single'} user ${uid} — attempt 1 finish:`, r1.choices[0]?.finish_reason);
    const content1 = r1.choices[0]?.message?.content ?? null;
    if (content1 && content1.trim().length > 0) {
      try {
        return jsonResponse(parseResponse(content1, r1.choices[0]?.finish_reason ?? null));
      } catch {
        console.log('[analyzePerfumeImage] JSON parse failed on attempt 1, retrying detail:high...');
      }
    }

    // Tentative 2 (detail: high) — contenu vide OU parse échoué
    const r2 = await callOpenAI('high');
    console.log('[analyzePerfumeImage] attempt 2 finish:', r2.choices[0]?.finish_reason);
    return jsonResponse(parseResponse(r2.choices[0]?.message?.content ?? null, r2.choices[0]?.finish_reason ?? null));
  } catch (e: unknown) {
    console.error('[analyzePerfumeImage]', (e as Error)?.message ?? String(e));
    return jsonResponse({ error: "Échec de l'analyse IA. Veuillez réessayer." }, 500);
  }
});
