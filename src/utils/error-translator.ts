// src/utils/error-translator.ts
// Traduction des codes d'erreur Supabase (gotrue + PostgREST) en messages
// localisés — les clés i18next sont résolues au moment de l'affichage (§23).

import i18next from 'i18next';

// Codes gotrue (supabase.auth) — champ `code` des AuthError
const SUPABASE_AUTH_KEYS = {
  invalid_credentials: 'errors.auth.invalidCredentials',
  email_not_confirmed: 'errors.auth.emailNotConfirmed',
  user_not_found: 'errors.auth.userNotFound',
  email_exists: 'errors.auth.emailExists',
  user_already_exists: 'errors.auth.emailExists',
  weak_password: 'errors.auth.weakPassword',
  over_request_rate_limit: 'errors.auth.overRequestRateLimit',
  session_not_found: 'errors.auth.sessionNotFound',
  reauthentication_needed: 'errors.auth.reauthenticationNeeded',
  network: 'errors.auth.network',
} as const;

// Codes PostgREST / SQLSTATE Postgres — champ `code` des erreurs .from()/.rpc()
const POSTGREST_ERROR_KEYS = {
  '42501': 'errors.db.permission',
  '23505': 'errors.db.unique',
  '23503': 'errors.db.fk',
  PGRST116: 'errors.db.notFound',
  PGRST301: 'errors.db.reauth',
} as const;

type AuthErrorKey = (typeof SUPABASE_AUTH_KEYS)[keyof typeof SUPABASE_AUTH_KEYS];
type DbErrorKey = (typeof POSTGREST_ERROR_KEYS)[keyof typeof POSTGREST_ERROR_KEYS];

export function translateSupabaseError(error: unknown): string {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (typeof code === 'string') {
    const authKey = (SUPABASE_AUTH_KEYS as Record<string, AuthErrorKey | undefined>)[code];
    if (authKey) return i18next.t(authKey);
    const dbKey = (POSTGREST_ERROR_KEYS as Record<string, DbErrorKey | undefined>)[code];
    if (dbKey) return i18next.t(dbKey);
    return i18next.t('errors.generic');
  }
  if (error instanceof Error && error.message) return error.message;
  return i18next.t('errors.unexpected');
}
