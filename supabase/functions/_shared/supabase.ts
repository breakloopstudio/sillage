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

/** Extrait l'UID utilisateur depuis un JWT Supabase (payload.sub). */
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
