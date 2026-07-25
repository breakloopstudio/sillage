import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import OpenAI from 'openai';
import { fetchWeatherForServer, scoreItemForWeather, weatherEmoji, getWmoMeta, type WardrobeEntry } from './weather-scoring';
import { evaluatePriceDrop, priceAlertRunId } from './logic/price-drop';
import { coordsKey, weatherRunId } from './logic/geo';
import { purgeDeadTokensForUser } from './fcm-utils';
import { checkAndIncrementQuota, MAX_SCANS_PER_DAY, MAX_VOICE_PER_DAY } from './rate-limit';

admin.initializeApp();

const db = admin.firestore();


/**
 * Cloud Function : checkPriceAlerts
 * Scheduled every 6 hours — checks all active price alerts for drops.
 * Utilise uniquement les données Firestore (bestPrice) — plus de dépendance à l'API Fragella.
 */
export const checkPriceAlerts = onSchedule({
    schedule: 'every 6 hours',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  }, async () => {
  const now = new Date();
  const runId = priceAlertRunId(now);
  let alertsChecked = 0;
  let notificationsSent = 0;
  let totalPurged = 0;

  const ALERTS_PAGE = 500;
  let lastAlertDoc: FirebaseFirestore.DocumentSnapshot | null = null;

  while (true) {
    let q = db.collectionGroup('priceAlerts').orderBy('__name__').limit(ALERTS_PAGE);
    if (lastAlertDoc) q = q.startAfter(lastAlertDoc);
    const alertsSnap = await q.get();
    if (alertsSnap.empty) break;

    // Deduplicate parfumIds — one read per unique parfum
    const parfumIds = new Set<string>();
    const alerts: { uid: string; doc: FirebaseFirestore.DocumentSnapshot; data: Record<string, unknown> }[] = [];
    for (const d of alertsSnap.docs) {
      const data = d.data();
      const pid = data.parfumId as string | undefined;
      if (!pid) continue;
      const uid = d.ref.path.split('/')[1]; // users/{uid}/priceAlerts/{docId}
      parfumIds.add(pid);
      alerts.push({ uid, doc: d, data });
    }

    // Fetch parfums in chunks of 30
    const parfumCache = new Map<string, { bestPrice: number | null; nom: string; marque: string }>();
    const idsArray = Array.from(parfumIds);
    const CHUNK = 30;
    for (let i = 0; i < idsArray.length; i += CHUNK) {
      const chunk = idsArray.slice(i, i + CHUNK);
      try {
        const refs = chunk.map(id => db.doc(`parfums/${id}`));
        const docs = await db.getAll(...refs);
        for (const d of docs) {
          if (!d.exists) continue;
          const p = d.data()!;
          parfumCache.set(d.id, {
            bestPrice: typeof p.bestPrice === 'number' ? p.bestPrice : null,
            nom: (p.nom as string) ?? '',
            marque: (p.marque as string) ?? '',
          });
        }
      } catch (err: unknown) {
        console.warn('[checkPriceAlerts] getAll chunk failed:', (err as Error)?.message ?? String(err));
      }
    }

    // Group triggered alerts by uid
    const triggeredByUid = new Map<string, {
      alertDoc: FirebaseFirestore.DocumentSnapshot;
      displayName: string;
      parfumId: string;
      currentPrice: number;
      dropPct: number;
    }[]>();

    for (const alert of alerts) {
      const pid = alert.data.parfumId as string;
      const lastPrice = typeof alert.data.lastPrice === 'number' ? alert.data.lastPrice : null;
      const parfum = parfumCache.get(pid);
      if (!parfum) continue;
      alertsChecked++;

      const result = evaluatePriceDrop(lastPrice, parfum.bestPrice);
      if (!result.triggered) {
        // Update lastPrice even if no drop
        try {
          await alert.doc.ref.set({ lastPrice: parfum.bestPrice, lastChecked: now.toISOString() }, { merge: true });
        } catch { /* best effort */ }
        continue;
      }

      const displayName = parfum.marque && parfum.nom ? `${parfum.marque} ${parfum.nom}` : pid;

      let arr = triggeredByUid.get(alert.uid);
      if (!arr) { arr = []; triggeredByUid.set(alert.uid, arr); }
      arr.push({
        alertDoc: alert.doc,
        displayName,
        parfumId: pid,
        currentPrice: parfum.bestPrice!,
        dropPct: result.dropPct,
      });
    }

    // Process triggered users in chunks of 20
    const triggeredUids = Array.from(triggeredByUid.entries());
    const USER_CHUNK = 20;
    for (let i = 0; i < triggeredUids.length; i += USER_CHUNK) {
      const chunk = triggeredUids.slice(i, i + USER_CHUNK);
      await Promise.allSettled(chunk.map(async ([uid, items]) => {
        try {
          // Idempotence marker
          const markerRef = db.doc(`users/${uid}/usage/${runId}`);
          const markerDoc = await markerRef.get();
          if (markerDoc.exists) return;

          // Settings check
          const settingsDoc = await db.doc(`users/${uid}/settings/preferences`).get();
          const settings = settingsDoc.data() ?? {};
          if (settings.priceAlerts !== true || settings.pushNotifs === false) return;

          // Tokens
          const tokensSnap = await db.collection(`users/${uid}/fcmTokens`).get();
          const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean) as string[];
          if (tokens.length === 0) return;

          // Send one notification per triggered parfum
          for (const item of items) {
            const message: admin.messaging.MulticastMessage = {
              tokens,
              notification: {
                title: '💰 Baisse de prix !',
                body: `${item.displayName} est passé à ${item.currentPrice.toFixed(0)} € (-${Math.round(item.dropPct * 100)}%)`,
              },
              data: { type: 'price_alert', parfumId: item.parfumId, newPrice: String(item.currentPrice) },
              android: { notification: { channelId: 'price_alerts', priority: 'high' } },
            };
            try {
              const response = await admin.messaging().sendEachForMulticast(message);
              notificationsSent += response.successCount;
              const purged = await purgeDeadTokensForUser(db, uid, tokens, response.responses);
              totalPurged += purged;
            } catch (err: unknown) {
              console.warn(`[checkPriceAlerts] Failed to notify ${uid}:`, (err as Error)?.message ?? String(err));
            }
          }

          // Write idempotence marker
          await markerRef.set({ runId, sent: items.length, at: now.toISOString() });

          // Update alert docs
          const batch = db.batch();
          for (const item of items) {
            batch.set(item.alertDoc.ref, { lastPrice: item.currentPrice, lastChecked: now.toISOString() }, { merge: true });
          }
          await batch.commit().catch(() => {});
        } catch { /* user-level failure is isolated */ }
      }));
    }

    lastAlertDoc = alertsSnap.docs[alertsSnap.docs.length - 1];
    if (alertsSnap.size < ALERTS_PAGE) break;
  }

  console.log(`[checkPriceAlerts] Done — ${alertsChecked} alerts checked, ${notificationsSent} sent, ${totalPurged} tokens purged`);
});

/**
 * Cloud Function : sendNotification
 * Envoie une notification push à un utilisateur ou à tous les utilisateurs.
 */
export const sendNotification = functions.https.onCall(
  { region: 'europe-west1' },
  async (
    request: functions.https.CallableRequest<{
      title: string;
      body: string;
      userId?: string;
      data?: Record<string, string>;
    }>
  ): Promise<{ success: boolean; sent: number; errors: number }> => {
    const { title, body, userId, data } = request.data;

    if (!title || !body) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Les champs "title" et "body" sont requis.'
      );
    }

    // Si userId spécifié, vérifier que c'est le même utilisateur (ou admin)
    if (userId && request.auth?.uid !== userId) {
      // Vérifier si l'utilisateur est admin
      const adminDoc = await admin
        .firestore()
        .collection('admins')
        .doc(request.auth?.uid ?? '')
        .get();
      if (!adminDoc.exists) {
        throw new functions.https.HttpsError(
          'permission-denied',
          "Vous ne pouvez envoyer des notifications qu'à vous-même."
        );
      }
    }

    const tokens: string[] = [];

    if (userId) {
      // Envoyer à un utilisateur spécifique
      const tokensSnapshot = await admin
        .firestore()
        .collection(`users/${userId}/fcmTokens`)
        .get();
      tokensSnapshot.forEach((doc) => {
        const t = doc.data().token;
        if (t) tokens.push(t);
      });
    } else {
      // Envoyer à tous les utilisateurs (admin uniquement via auth check ci-dessus)
      if (!request.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'Authentification requise pour envoyer à tous les utilisateurs.'
        );
      }
      // collectionGroup paginé pour éviter de charger tous les users
      const TOKENS_PAGE = 500;
      let lastTokenDoc: FirebaseFirestore.DocumentSnapshot | null = null;
      while (true) {
        let q0 = admin.firestore().collectionGroup('fcmTokens').orderBy('__name__').limit(TOKENS_PAGE);
        if (lastTokenDoc) q0 = q0.startAfter(lastTokenDoc);
        const snap = await q0.get();
        if (snap.empty) break;
        for (const d of snap.docs) {
          const t = d.data().token;
          if (t) tokens.push(t);
        }
        lastTokenDoc = snap.docs[snap.docs.length - 1];
        if (snap.size < TOKENS_PAGE) break;
      }
    }

    if (tokens.length === 0) {
      return { success: true, sent: 0, errors: 0 };
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      webpush: {
        notification: {
          icon: '/assets/icons/manifest-icon-192.maskable.png',
          badge: '/assets/icons/manifest-icon-192.maskable.png',
        },
        fcmOptions: {
          link: data?.url ?? '/',
        },
      },
      data: data ?? {},
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    const errors = response.responses.filter((r) => !r.success).length;

    console.log(
      `📨 Notification envoyée : ${response.successCount} succès, ${errors} échecs`
    );

    return {
      success: true,
      sent: response.successCount,
      errors,
    };
  }

);

interface ScanResult {
  marque: string | null;
  nom: string | null;
  volumeMl: number | null;
  typeParfum: string | null;
  confidence: 'high' | 'low';
}

/**
 * Extrait un objet JSON d'une chaîne de texte (supporte markdown fences et texte autour).
 */
function extractJson(text: string): string {
  // Essayer d'extraire depuis des fences markdown ```json ... ```
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Sinon, chercher la première { et dernière }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

/**
 * Cloud Function : analyzePerfumeImage
 * Reçoit une image base64, appelle OpenAI GPT-4o Vision,
 * et retourne les informations du parfum détecté.
 */
export const analyzePerfumeImage = functions.https.onCall(
  { region: 'europe-west1', timeoutSeconds: 120, memory: '512MiB' },
  async (request: functions.https.CallableRequest<{ imageBase64?: string; imagesBase64?: string[] }>): Promise<ScanResult> => {
    const { imageBase64, imagesBase64 } = request.data;

    if (!request.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'Connexion requise pour analyser une image.');
    }

    await checkAndIncrementQuota(db, request.auth.uid, 'scan', MAX_SCANS_PER_DAY);

    const isBurst = Array.isArray(imagesBase64) && imagesBase64.length > 0;
    const hasSingle = typeof imageBase64 === 'string' && imageBase64.length > 0;

    if (!isBurst && !hasSingle) {
      throw new functions.https.HttpsError('invalid-argument', 'Le paramètre "imageBase64" ou "imagesBase64" est requis.');
    }

    const images: string[] = isBurst ? imagesBase64! : [imageBase64!];

    for (const img of images) {
      if (typeof img !== 'string' || !img.startsWith('data:image/')) {
        throw new functions.https.HttpsError('invalid-argument', "Chaque image doit être en base64 avec préfixe \"data:image/\".");
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError('internal', 'Clé API OpenAI non configurée.');
    }

    const openai = new OpenAI({ apiKey });

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

    const callOpenAI = async (detail: 'auto' | 'high') => {
      return openai.chat.completions.create({
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
    };

    const parseResponse = (content: string | null, finishReason: string | null): ScanResult => {
      if (!content || content.trim().length === 0) {
        console.error('[analyzePerfumeImage] Empty content, finish_reason:', finishReason);
        throw new functions.https.HttpsError('internal', "Réponse vide de l'IA.");
      }

      const jsonStr = extractJson(content);
      console.log('[analyzePerfumeImage] Parsed JSON length:', jsonStr.length);

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr: unknown) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        console.error('[analyzePerfumeImage] JSON parse error:', msg);
        console.error('[analyzePerfumeImage] Raw content (first 300 chars):', content.slice(0, 300));
        throw new functions.https.HttpsError('internal', "Réponse de l'IA invalide. Réessayez.");
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
      const response = await callOpenAI('auto');
      const finishReason = response.choices[0]?.finish_reason;
      console.log(`[analyzePerfumeImage] ${isBurst ? `Burst (${images.length} images)` : 'Single'} — Attempt 1 finish_reason:`, finishReason);

      const content = response.choices[0]?.message?.content;
      if (content && content.trim().length > 0) {
        try {
          return parseResponse(content, finishReason ?? null);
        } catch {
          // JSON parse failed — retry with detail:'high'
          console.log('[analyzePerfumeImage] JSON parse failed on attempt 1, retrying with detail:high...');
        }
      }

      // Fallback: empty content or parse failure → retry with detail:'high'
      console.log('[analyzePerfumeImage] Retrying with detail:high...');
      const retryResponse = await callOpenAI('high');
      const retryFinish = retryResponse.choices[0]?.finish_reason;
      console.log('[analyzePerfumeImage] Attempt 2 — finish_reason:', retryFinish);

      return parseResponse(retryResponse.choices[0]?.message?.content ?? null, retryFinish ?? null);
    } catch (error: unknown) {
      if (error instanceof functions.https.HttpsError) throw error;
      const message = error instanceof Error ? error.message : 'Erreur inconnue.';
      console.error('OpenAI API error:', message);
      throw new functions.https.HttpsError('internal', "Échec de l'analyse IA. Veuillez réessayer.");
    }
  }
);

/**
 * Cloud Function : transcribeVoice
 * Reçoit un fichier audio en base64, appelle OpenAI Whisper,
 * et retourne la transcription texte.
 * Fallback pour la recherche vocale quand le STT on-device échoue.
 */
export const transcribeVoice = functions.https.onCall(
  { region: 'europe-west1' },
  async (request: functions.https.CallableRequest<{
    audioBase64: string;
    mimeType: string;
  }>): Promise<{ text: string }> => {
    if (!request.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentification requise pour la transcription vocale.');
    }

    await checkAndIncrementQuota(db, request.auth.uid, 'voice', MAX_VOICE_PER_DAY);

    const { audioBase64, mimeType } = request.data;

    if (typeof audioBase64 !== 'string' || audioBase64.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Le paramètre "audioBase64" est requis.');
    }
    if (typeof mimeType !== 'string' || mimeType.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Le paramètre "mimeType" est requis.');
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError('internal', 'Clé API OpenAI non configurée.');
    }

    const openai = new OpenAI({ apiKey });

    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB limit
    if (audioBase64.length > MAX_BYTES * 1.37) {
      throw new functions.https.HttpsError('invalid-argument', 'Fichier audio trop volumineux (max 10 Mo).');
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    const ext = mimeType === 'audio/wav' ? '.wav' : mimeType === 'audio/mp4' ? '.m4a' : '.audio';
    const file = new File([buffer], `audio${ext}`, { type: mimeType });

    try {
      const transcription = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file,
        response_format: 'text',
        language: 'fr',
        prompt: 'Dior, Chanel, Guerlain, Yves Saint Laurent, Lancôme, Hermès, Jean Paul Gaultier, Paco Rabanne, Givenchy, Versace, Armani, Tom Ford, Calvin Klein, Hugo Boss, Burberry, Dolce & Gabbana, Bvlgari, Creed, Le Labo, Byredo, Diptyque, Maison Margiela, Prada, Valentino, Azzaro, Kenzo, Mugler, Cartier, Cacharel, Lalique, Acqua di Parma, Maison Francis Kurkdjian, Xerjoff, Parfums de Marly, Amouage, By Kilian, Initio',
      });

      console.log('[transcribeVoice] User:', request.auth.uid, 'Transcription:', transcription);
      return { text: transcription };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue.';
      console.error('[transcribeVoice] Whisper error:', message);
      throw new functions.https.HttpsError('internal', 'Échec de la transcription vocale. Veuillez réessayer.');
    }
  }
);

/**
 * Cloud Function : sendWeatherNotifications
 * Scheduled every day at 7:00 AM Europe/Paris.
 * Sends a personalised perfume suggestion based on current weather.
 */
export const sendWeatherNotifications = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const now = new Date();
    const runId = weatherRunId(now);
    let processed = 0;
    let sent = 0;
    let locations = 0;
    let totalPurged = 0;

    const SETTINGS_PAGE = 500;
    let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    // Cache: coordKey → meteo (1 fetch per location)
    const weatherCache = new Map<string, { temperature: number; weatherCode: number; isDay: boolean; dailyMax: number }>();

    while (true) {
      let q = db.collectionGroup('settings').where('weatherNotifs', '==', true).orderBy('__name__').limit(SETTINGS_PAGE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;

      const eligible: { uid: string; lat: number; lon: number }[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        if (data.pushNotifs === false) continue;
        if (typeof data.weatherLat !== 'number' || typeof data.weatherLon !== 'number') continue;
        const uid = d.ref.path.split('/')[1];
        eligible.push({ uid, lat: data.weatherLat, lon: data.weatherLon });
      }

      // Fetch weather per unique location
      for (const u of eligible) {
        const key = coordsKey(u.lat, u.lon);
        if (!weatherCache.has(key)) {
          try {
            const w = await fetchWeatherForServer(u.lat, u.lon);
            if (w) { weatherCache.set(key, w); locations++; }
          } catch (err: unknown) {
            console.warn('[sendWeatherNotifications] weather fetch failed for', key, (err as Error)?.message ?? String(err));
          }
        }
      }

      // Process in chunks of 20
      const USER_CHUNK = 20;
      for (let i = 0; i < eligible.length; i += USER_CHUNK) {
        const chunk = eligible.slice(i, i + USER_CHUNK);
        await Promise.allSettled(chunk.map(async ({ uid, lat, lon }) => {
          try {
            // Idempotence marker
            const markerRef = db.doc(`users/${uid}/usage/${runId}`);
            const markerDoc = await markerRef.get();
            if (markerDoc.exists) return;

            const weather = weatherCache.get(coordsKey(lat, lon));
            if (!weather) return;

            // Wardrobe
            const wardrobeSnap = await db.collection(`users/${uid}/wardrobe`).get();
            const wardrobeItems = wardrobeSnap.docs
              .map(d => ({ parfumId: d.id, ...d.data() } as WardrobeEntry))
              .filter(i => i.ownership === 'have');
            if (wardrobeItems.length === 0) return;

            const scored = wardrobeItems
              .map(item => ({ item, score: scoreItemForWeather(item, weather) }))
              .sort((a, b) => b.score - a.score);
            const top = scored[0];
            if (!top || top.score < 30) return;

            // Tokens
            const tokensSnap = await db.collection(`users/${uid}/fcmTokens`).get();
            const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean) as string[];
            if (tokens.length === 0) return;

            const wmo = getWmoMeta(weather.weatherCode);
            const icon = weather.isDay ? wmo.icon : (NIGHT_ICON[wmo.icon] ?? wmo.icon);
            const emoji = weatherEmoji(icon);
            const title = `${emoji} ${Math.round(weather.temperature)}°C`;
            const body = `Aujourd'hui : ${top.item.nom ?? '?'} de ${top.item.marque ?? '?'} (${top.score}% compatible)`;

            const message: admin.messaging.MulticastMessage = {
              tokens,
              notification: { title, body },
              data: { type: 'weather-suggestion', parfumId: top.item.parfumId },
              android: { notification: { channelId: 'weather_suggestions', priority: 'high' } },
            };

            try {
              const response = await admin.messaging().sendEachForMulticast(message);
              sent += response.successCount;
              const purged = await purgeDeadTokensForUser(db, uid, tokens, response.responses);
              totalPurged += purged;
            } catch (err: unknown) {
              console.warn(`[sendWeatherNotifications] Failed to notify ${uid}:`, (err as Error)?.message ?? String(err));
            }

            processed++;
            await markerRef.set({ runId, at: now.toISOString() });
          } catch { /* user-level failure is isolated */ }
        }));
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < SETTINGS_PAGE) break;
    }

    console.log(`[sendWeatherNotifications] Done — ${processed} processed, ${sent} sent, ${locations} locations, ${totalPurged} purged`);
  }
);

export { deleteUserAccount, exportUserData } from './account';

const NIGHT_ICON: Record<string, string> = {
  sunny: 'moon',
  'partly-sunny': 'cloudy-night',
};
