// Supabase Edge Function: analyze-perfume-image (v2)
// GPT Vision — lecture de flacon. Structured Outputs (JSON garanti, zéro retry de parse),
// modèle rapide configurable + escalade ciblée, 1 image par défaut, detail low (vitesse).

import OpenAI from 'npm:openai';
import { createUserClient, verifyUserToken } from '../_shared/supabase.ts';

interface ScanResult {
  marque: string | null;
  nom: string | null;
  volumeMl: number | null;
  typeParfum: string | null;
  confidence: 'high' | 'low';
  alternatives: string[];
}

// Modèle rapide (lecture d'étiquette) + modèle fort (escalade si rien n'est lu).
// Surchargeables via secrets pour suivre l'évolution des modèles sans redéploiement de code.
const FAST_MODEL = Deno.env.get('SCAN_MODEL') ?? 'gpt-4o-mini';
const STRONG_MODEL = Deno.env.get('SCAN_MODEL_STRONG') ?? 'gpt-4o';

// Structured Outputs : la réponse est garantie conforme au schéma → plus de retry JSON.
const SCAN_SCHEMA = {
  name: 'perfume_scan',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      marque: { type: ['string', 'null'] },
      nom: { type: ['string', 'null'] },
      volumeMl: { type: ['integer', 'null'] },
      typeParfum: { type: ['string', 'null'] },
      confidence: { type: 'string', enum: ['high', 'low'] },
      alternatives: { type: 'array', items: { type: 'string' } },
    },
    required: ['marque', 'nom', 'volumeMl', 'typeParfum', 'confidence', 'alternatives'],
    additionalProperties: false,
  },
};

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

  const openai = new OpenAI({ apiKey, timeout: 40_000 });

  const multi = images.length > 1;
  const PROMPT = `Tu es un expert en parfumerie. Tu analyses ${multi ? `${images.length} photos du MÊME flacon prises sous des angles différents` : 'une photo de flacon de parfum'}. ${multi ? 'Fusionne les lectures en un résultat unique en te fiant à la photo la plus nette. ' : ''}Lis la marque et le nom sur le flacon/l'étiquette.

Retourne les champs :
- marque: la maison (ex: "Dior", "Chanel", "Xerjoff"). null si illisible.
- nom: le nom du parfum (ex: "Sauvage", "N°5"). null si illisible.
- volumeMl: volume en ml (ex: 100). null si non visible.
- typeParfum: "Eau de Parfum", "Eau de Toilette", "Extrait", "Parfum", "Eau de Cologne" ou null.
- confidence: "high" si marque ET nom clairement lisibles, sinon "low".
- alternatives: si le nom est incertain, 1 à 2 autres lectures plausibles du nom (sinon tableau vide).

RÈGLES :
- N'invente JAMAIS un champ absent (mets null). Ne devine pas volumeMl/typeParfum s'ils ne sont pas visibles.
- Si partiellement visible, donne ta meilleure estimation et mets confidence:"low".`;

  const callOpenAI = (model: string, detail: 'low' | 'high') => openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          ...images.map((img) => ({ type: 'image_url' as const, image_url: { url: img, detail } })),
        ],
      },
    ],
    max_tokens: 250,
    temperature: 0.1,
    response_format: { type: 'json_schema', json_schema: SCAN_SCHEMA },
  });

  const parseResponse = (content: string | null): ScanResult => {
    if (!content || content.trim().length === 0) throw new Error("Réponse vide de l'IA.");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {
      marque: typeof parsed.marque === 'string' ? parsed.marque : null,
      nom: typeof parsed.nom === 'string' ? parsed.nom : null,
      volumeMl: typeof parsed.volumeMl === 'number' ? parsed.volumeMl : null,
      typeParfum: typeof parsed.typeParfum === 'string' ? parsed.typeParfum : null,
      confidence: parsed.confidence === 'high' ? 'high' : 'low',
      alternatives: Array.isArray(parsed.alternatives)
        ? parsed.alternatives.filter((a): a is string => typeof a === 'string').slice(0, 2)
        : [],
    };
  };

  try {
    // Tentative 1 — modèle rapide, detail low (le plus courant, le plus rapide).
    const r1 = await callOpenAI(FAST_MODEL, 'low');
    console.log(`[analyze] ${multi ? `burst(${images.length})` : 'single'} user ${uid} fast=${FAST_MODEL} finish:`, r1.choices[0]?.finish_reason);
    const result = parseResponse(r1.choices[0]?.message?.content ?? null);

    // something lu → on renvoie directement (le matching + alternatives gèrent l'incertitude).
    if (result.marque || result.nom) return jsonResponse(result);

    // Rien de lu → escalade ciblée : modèle fort + detail high (une seule fois).
    console.log(`[analyze] empty read, escalating to ${STRONG_MODEL} detail:high`);
    const r2 = await callOpenAI(STRONG_MODEL, 'high');
    return jsonResponse(parseResponse(r2.choices[0]?.message?.content ?? null));
  } catch (e: unknown) {
    console.error('[analyze]', (e as Error)?.message ?? String(e));
    return jsonResponse({ error: "Échec de l'analyse IA. Veuillez réessayer." }, 500);
  }
});
