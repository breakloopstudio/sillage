// Supabase Edge Function: send-weather-notifications
// Cron 7h Paris — envoie une suggestion de parfum basée sur la météo du jour.
// Appelée par pg_cron → pg_net avec Authorization Bearer <service_role_key>.

import { createAdminClient, verifyCronAuth } from '../_shared/supabase.ts';
import { coordsKey, weatherRunId } from '../_shared/helpers.ts';
import { fetchWeatherForServer, scoreItemForWeather, getWmoMeta, weatherEmoji, type WardrobeEntry, type WeatherData } from '../_shared/weather-scoring.ts';
import { sendPush, purgeDeadTokens } from '../_shared/expo-push.ts';

const NIGHT_ICON: Record<string, string> = {
  sunny: 'moon',
  'partly-sunny': 'cloudy-night',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!verifyCronAuth(req)) return jsonResponse({ error: 'Unauthorized.' }, 401);
  const supabase = createAdminClient();
  const now = new Date();
  const runId = weatherRunId(now);

  // Utilisateurs éligibles (weatherNotifs + pushNotifs + coordonnées GPS).
  // Paginé : PostgREST tronque silencieusement à db-max-rows (1000) sans .range().
  const PAGE = 1000;
  const rows: { user_id: string; weather_lat: number; weather_lon: number }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await supabase
      .from('user_settings')
      .select('user_id, weather_lat, weather_lon')
      .eq('weather_notifs', true)
      .eq('push_notifs', true)
      .not('weather_lat', 'is', null)
      .not('weather_lon', 'is', null)
      .order('user_id')
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('[sendWeather] fetch eligible error:', error.message);
      return jsonResponse({ ok: false }, 500);
    }
    if (!page || page.length === 0) break;
    rows.push(...(page as { user_id: string; weather_lat: number; weather_lon: number }[]));
    if (page.length < PAGE) break;
  }
  if (rows.length === 0) {
    console.log('[sendWeather] No eligible users.');
    return jsonResponse({ ok: true, processed: 0, sent: 0 });
  }

  // Cache météo : 1 fetch par coordonnées arrondies
  const weatherCache = new Map<string, WeatherData>();
  let processed = 0, sent = 0, purged = 0;

  const BATCH = 10;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(async (row) => {
      // Idempotence : conflit PK = déjà exécuté ce run
      const { error: insertErr } = await supabase.from('notification_runs').insert({ user_id: row.user_id, run_id: runId });
      if (insertErr) return { sent: 0, purged: 0, processed: 0 };

      // Météo
      const key = coordsKey(row.weather_lat, row.weather_lon);
      if (!weatherCache.has(key)) {
        const w = await fetchWeatherForServer(row.weather_lat, row.weather_lon);
        if (w) weatherCache.set(key, w);
      }
      const weather = weatherCache.get(key);
      if (!weather) return { sent: 0, purged: 0, processed: 0 };

      // Parfumerie (status = 'have')
      const { data: wardrobe } = await supabase
        .from('user_parfum')
        .select('parfum_id, nom, marque, famille_olfactive, is_signature, sotd_count')
        .eq('user_id', row.user_id)
        .eq('status', 'have');
      if (!wardrobe || wardrobe.length === 0) return { sent: 0, purged: 0, processed: 0 };

      const items: WardrobeEntry[] = (wardrobe as Record<string, unknown>[]).map(w => ({
        parfumId: w.parfum_id as string,
        nom: (w.nom as string) ?? null,
        marque: (w.marque as string) ?? null,
        familleOlactive: (w.famille_olfactive as string) ?? null,
        ownership: 'have',
        isSignature: w.is_signature === true,
        sotdCount: typeof w.sotd_count === 'number' ? w.sotd_count : 0,
      }));

      const scored = items
        .map(item => ({ item, score: scoreItemForWeather(item, weather) }))
        .sort((a, b) => b.score - a.score);
      const top = scored[0];
      if (!top || top.score < 30) return { sent: 0, purged: 0, processed: 0 };

      // Tokens
      const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', row.user_id);
      if (!tokens || tokens.length === 0) return { sent: 0, purged: 0, processed: 0 };
      const tokenList = (tokens as { token: string }[]).map(t => t.token);

      const wmo = getWmoMeta(weather.weatherCode);
      const icon = weather.isDay ? wmo.icon : (NIGHT_ICON[wmo.icon] ?? wmo.icon);
      const title = `${weatherEmoji(icon)} ${Math.round(weather.temperature)}°C`;
      const body = `Aujourd'hui : ${top.item.nom ?? '?'} de ${top.item.marque ?? '?'} (${top.score}% compatible)`;

      const { successCount, deadTokens } = await sendPush(tokenList, title, body, {
        type: 'weather-suggestion',
        parfumId: top.item.parfumId,
      });
      const purgedCount = await purgeDeadTokens(supabase, deadTokens);
      return { sent: successCount, purged: purgedCount, processed: 1 };
    }));

    for (const r of results) {
      if (r.status === 'fulfilled') {
        sent += r.value.sent;
        purged += r.value.purged;
        processed += r.value.processed;
      } else {
        console.warn('[sendWeather] batch item failed:', (r.reason as Error)?.message ?? String(r.reason));
      }
    }
  }

  console.log(`[sendWeather] Done — ${processed} processed, ${sent} sent, ${purged} purged, ${weatherCache.size} locations`);
  return jsonResponse({ ok: true, processed, sent, locations: weatherCache.size });
});
