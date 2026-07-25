// Supabase Edge Function: delete-user-account
// Suppression RGPD (auto-cascade via FK ON DELETE CASCADE + suppression du user
// via l'API Admin GoTrue). Réauthentification récente exigée.
// ⚠️ Les JWT Supabase n'ont PAS de claim `auth_time` (c'est Firebase) — on
// vérifie la fraîcheur via `amr[].timestamp` puis `iat` en repli.

import { getUserIdFromAuth } from '../_shared/supabase.ts';

const REAUTH_WINDOW_S = 300;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(atob(token.split('.')[1]));
  } catch {
    return jsonResponse({ error: 'Invalid token.' }, 400);
  }

  let uid: string;
  try { uid = getUserIdFromAuth(req); } catch {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  // Fraîcheur de l'authentification : timestamp le plus récent dans amr[],
  // repli sur iat (émission du token — une réauthentification signInWithPassword
  // émet un nouveau token avec iat = maintenant).
  let lastAuth = 0;
  const amr = payload.amr as { timestamp?: number }[] | undefined;
  if (Array.isArray(amr)) {
    for (const m of amr) {
      if (typeof m?.timestamp === 'number' && m.timestamp > lastAuth) lastAuth = m.timestamp;
    }
  }
  if (lastAuth === 0 && typeof payload.iat === 'number') {
    lastAuth = payload.iat;
  }
  if (lastAuth === 0 || (Date.now() / 1000 - lastAuth) > REAUTH_WINDOW_S) {
    return jsonResponse({ error: 'REAUTH_REQUIRED' }, 400);
  }

  // Suppression via l'API Admin GoTrue — les données sont purgées
  // automatiquement par FK ON DELETE CASCADE sur toutes les tables user.
  // ⚠️ GoTrue exige les DEUX headers : apikey ET Authorization.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${uid}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    },
  });

  if (!res.ok) {
    console.error('[deleteUserAccount] admin delete returned', res.status, await res.text());
    return jsonResponse({ error: 'La suppression a échoué. Réessayez plus tard.' }, 500);
  }

  console.log('[deleteUserAccount] deleted', uid, new Date().toISOString());
  return jsonResponse({ success: true });
});
