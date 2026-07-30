// src/utils/error-translator.ts
// Traduction des codes d'erreur Supabase (gotrue + PostgREST) en messages FR.

// Codes gotrue (supabase.auth) — champ `code` des AuthError
const SUPABASE_AUTH_MAP: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe incorrect.',
  email_not_confirmed: 'Confirmez votre email avant de vous connecter.',
  user_not_found: 'Aucun compte trouvé avec cet email.',
  email_exists: 'Cet email est déjà utilisé.',
  user_already_exists: 'Cet email est déjà utilisé.',
  weak_password: 'Le mot de passe doit contenir au moins 6 caractères.',
  over_request_rate_limit: 'Trop de tentatives. Réessayez plus tard.',
  session_not_found: 'Session expirée. Reconnectez-vous.',
  reauthentication_needed: 'Par sécurité, reconnectez-vous avant cette action.',
  network: 'Problème de connexion réseau.',
};

// Codes PostgREST / SQLSTATE Postgres — champ `code` des erreurs .from()/.rpc()
const POSTGREST_ERROR_MAP: Record<string, string> = {
  '42501': 'Permission refusée.',
  '23505': 'Cet élément existe déjà.',
  '23503': 'Référence introuvable.',
  PGRST116: 'Élément introuvable.',
  PGRST301: 'Connexion requise. Veuillez vous reconnecter.',
};

export function translateSupabaseError(error: unknown): string {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (typeof code === 'string') {
    const message = SUPABASE_AUTH_MAP[code] ?? POSTGREST_ERROR_MAP[code];
    if (message !== undefined) return message;
    return 'Une erreur est survenue. Réessayez.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Une erreur inattendue est survenue.';
}
