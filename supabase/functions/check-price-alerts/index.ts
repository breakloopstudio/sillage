// Supabase Edge Function: check-price-alerts
// Cron 6h — vérifie toutes les alertes prix actives pour baisses ≥ 10% ou ≥ 5€.
// Appelée par pg_cron → pg_net avec Authorization Bearer <service_role_key>.

import { createAdminClient, verifyCronAuth } from '../_shared/supabase.ts';
import { evaluatePriceDrop, priceAlertRunId } from '../_shared/helpers.ts';
import { sendPush, purgeDeadTokens } from '../_shared/expo-push.ts';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (!verifyCronAuth(req)) return jsonResponse({ error: 'Unauthorized.' }, 401);
  const supabase = createAdminClient();
  const now = new Date();
  const runId = priceAlertRunId(now);

  // 1. Toutes les alertes (pas de FK vers parfums dans le schéma → 2 requêtes + jointure JS)
  const { data: alerts, error } = await supabase
    .from('price_alerts')
    .select('user_id, parfum_id, last_price');
  if (error) {
    console.error('[checkPriceAlerts] fetch alerts error:', error.message);
    return jsonResponse({ ok: false }, 500);
  }
  if (!alerts || alerts.length === 0) {
    console.log('[checkPriceAlerts] No alerts.');
    return jsonResponse({ ok: true, checked: 0, sent: 0 });
  }

  // 2. Parfums concernés (dédoublonnés, par chunks de 300 pour l'opérateur in)
  const parfumIds = [...new Set((alerts as { parfum_id: string }[]).map(a => a.parfum_id))];
  const parfumMap = new Map<string, { bestPrice: number | null; nom: string; marque: string }>();
  for (let i = 0; i < parfumIds.length; i += 300) {
    const chunk = parfumIds.slice(i, i + 300);
    const { data: parfums, error: pErr } = await supabase
      .from('parfums')
      .select('id, best_price, nom, marque')
      .in('id', chunk);
    if (pErr) { console.warn('[checkPriceAlerts] parfums chunk error:', pErr.message); continue; }
    for (const p of (parfums ?? []) as { id: string; best_price: number | null; nom: string; marque: string }[]) {
      parfumMap.set(p.id, { bestPrice: p.best_price, nom: p.nom, marque: p.marque });
    }
  }

  // 3. Évaluation + regroupement par user + collecte des mises à jour last_price
  interface TriggeredItem { displayName: string; parfumId: string; currentPrice: number; dropPct: number; }
  const byUser = new Map<string, TriggeredItem[]>();
  const priceUpdates: { user_id: string; parfum_id: string; last_price: number; last_checked: string }[] = [];
  let checked = 0;

  for (const a of alerts as { user_id: string; parfum_id: string; last_price: number | null }[]) {
    const parfum = parfumMap.get(a.parfum_id);
    if (!parfum || parfum.bestPrice === null) continue;
    checked++;

    const drop = evaluatePriceDrop(a.last_price, parfum.bestPrice);

    // Toujours mettre à jour last_price (parité Firebase : évite les re-notifications)
    priceUpdates.push({
      user_id: a.user_id,
      parfum_id: a.parfum_id,
      last_price: parfum.bestPrice,
      last_checked: now.toISOString(),
    });

    if (!drop.triggered) continue;
    const arr = byUser.get(a.user_id) ?? [];
    arr.push({
      displayName: `${parfum.marque} ${parfum.nom}`,
      parfumId: a.parfum_id,
      currentPrice: parfum.bestPrice,
      dropPct: drop.dropPct,
    });
    byUser.set(a.user_id, arr);
  }

  // 4. Mise à jour des last_price en batch (upsert sur PK user_id+parfum_id)
  if (priceUpdates.length > 0) {
    const { error: upErr } = await supabase.from('price_alerts').upsert(priceUpdates as never);
    if (upErr) console.warn('[checkPriceAlerts] last_price upsert error:', upErr.message);
  }

  // 5. Notifications
  let sent = 0;
  let purged = 0;
  for (const [uid, items] of byUser.entries()) {
    try {
      // Idempotence : insert notification_runs — conflit PK = déjà exécuté ce run
      const { error: insertErr } = await supabase.from('notification_runs').insert({ user_id: uid, run_id: runId, sent_count: items.length });
      if (insertErr) continue;

      // Settings
      const { data: settings } = await supabase.from('user_settings').select('price_alerts,push_notifs').eq('user_id', uid).maybeSingle();
      if (!settings || settings.price_alerts !== true || settings.push_notifs === false) continue;

      // Tokens
      const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', uid);
      if (!tokens || tokens.length === 0) continue;
      const tokenList = (tokens as { token: string }[]).map(t => t.token);

      for (const item of items) {
        const body = `${item.displayName} est passé à ${item.currentPrice.toFixed(0)} € (-${Math.round(item.dropPct * 100)}%)`;
        const { successCount, deadTokens } = await sendPush(tokenList, '💰 Baisse de prix !', body, {
          type: 'price_alert',
          parfumId: item.parfumId,
          newPrice: String(item.currentPrice),
        });
        sent += successCount;
        purged += await purgeDeadTokens(supabase, deadTokens);
      }
    } catch (e: unknown) {
      console.warn(`[checkPriceAlerts] user ${uid}:`, (e as Error)?.message ?? String(e));
    }
  }

  console.log(`[checkPriceAlerts] Done — ${checked} checked, ${byUser.size} users triggered, ${sent} sent, ${purged} purged`);
  return jsonResponse({ ok: true, checked, triggered: byUser.size, sent });
});
