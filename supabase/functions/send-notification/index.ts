// Supabase Edge Function: send-notification
// Envoi push à un utilisateur ou broadcast. Appel client (self ou admin)
// ou appel interne avec service_role (cron).

import { createAdminClient, verifyUserToken } from '../_shared/supabase.ts';
import { sendPush, purgeDeadTokens } from '../_shared/expo-push.ts';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const supabase = createAdminClient();
  let body: { title: string; body: string; userId?: string; data?: Record<string, string> };
  try { body = await req.json(); } catch { return jsonResponse({ error: 'JSON invalide.' }, 400); }

  const { title, body: msg, userId, data } = body;
  if (!title || !msg) return jsonResponse({ error: 'title et body requis.' }, 400);

  // Auth : service_role (cron) = bypass ; sinon JWT utilisateur (self ou admin)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  let isServiceRole = false;
  if (serviceKey && token.length === serviceKey.length) {
    let mismatch = 0;
    for (let i = 0; i < token.length; i++) mismatch |= token.charCodeAt(i) ^ serviceKey.charCodeAt(i);
    isServiceRole = mismatch === 0;
  }

  if (!isServiceRole) {
    let uid: string;
    try { uid = (await verifyUserToken(req)).uid; } catch {
      return jsonResponse({ error: 'Unauthorized.' }, 401);
    }
    if (userId && uid !== userId) {
      const { data: isAdmin } = await supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle();
      if (!isAdmin) return jsonResponse({ error: "Vous ne pouvez envoyer des notifications qu'à vous-même." }, 403);
    }
    if (!userId) {
      // Broadcast réservé aux admins
      const { data: isAdmin } = await supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle();
      if (!isAdmin) return jsonResponse({ error: 'Broadcast réservé aux admins.' }, 403);
    }
  }

  // Tokens
  let tokens: string[] = [];
  if (userId) {
    const { data: rows } = await supabase.from('push_tokens').select('token').eq('user_id', userId);
    tokens = (rows ?? []).map((r: { token: string }) => r.token);
  } else {
    // Broadcast — pagination par id
    let lastId: string | null = null;
    const limit = 500;
    for (;;) {
      let q = supabase.from('push_tokens').select('id, token').order('id', { ascending: true }).limit(limit);
      if (lastId) q = q.gt('id', lastId);
      const { data: batch, error } = await q;
      if (error || !batch || batch.length === 0) break;
      tokens.push(...(batch as { token: string }[]).map(r => r.token));
      lastId = (batch[batch.length - 1] as { id: string }).id;
      if (batch.length < limit) break;
    }
  }

  if (tokens.length === 0) return jsonResponse({ success: true, sent: 0, errors: 0 });

  const { successCount, deadTokens } = await sendPush(tokens, title, msg, data);
  const purged = await purgeDeadTokens(supabase, deadTokens);

  return jsonResponse({ success: true, sent: successCount, purged });
});
