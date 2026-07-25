// supabase/functions/_shared/supabase.ts — Client Supabase pour Edge Functions
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Client admin (service_role) — cron, opérations privilégiées. */
export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

/** Client authentifié (JWT utilisateur passé par le front). */
export function createUserClient(authHeader: string): SupabaseClient {
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
}

/** Vérifie le JWT côté serveur via auth.getUser() et retourne l'UID + AMR. */
export async function verifyUserToken(req: Request): Promise<{ uid: string; amr?: { method: string; timestamp: number }[] }> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing Authorization');
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Invalid token');
  return { uid: user.id, amr: user.amr };
}

/** Vérifie que l'appel provient du cron (pg_cron → pg_net). */
export function verifyCronAuth(req: Request): boolean {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const cronKey = Deno.env.get('CRON_SERVICE_ROLE_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return token === cronKey || token === serviceKey;
}

/** @deprecated Utiliser verifyUserToken() — ne vérifie PAS la signature. */
export function getUserIdFromAuth(req: Request): string {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub as string;
  } catch {
    throw new Error('Invalid Authorization token');
  }
}
