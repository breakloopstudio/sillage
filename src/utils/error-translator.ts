// src/utils/error-translator.ts
// Mapping des codes d'erreur Firebase vers messages en français.

const AUTH_ERROR_MAP: Record<string, string> = {
  'auth/email-already-in-use': 'Cet email est déjà utilisé.',
  'auth/invalid-email': "L'adresse email n'est pas valide.",
  'auth/user-not-found': 'Aucun compte trouvé avec cet email.',
  'auth/wrong-password': 'Mot de passe incorrect.',
  'auth/invalid-credential': 'Email ou mot de passe incorrect.',
  'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères.',
  'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
  'auth/network-request-failed': 'Problème de connexion réseau.',
  'auth/internal-error': 'Une erreur interne est survenue.',
  'auth/popup-closed-by-user': 'Fenêtre de connexion fermée.',
  'auth/user-disabled': 'Ce compte a été désactivé.',
  'auth/account-exists-with-different-credential': 'Un compte existe déjà avec cet email via un autre mode de connexion.',
  'auth/cancelled': '',
  'auth/requires-recent-login': 'Par sécurité, reconnectez-vous avant cette action.',
  'auth/user-mismatch': "Les identifiants ne correspondent pas à ce compte.",
};

const FIRESTORE_ERROR_MAP: Record<string, string> = {
  'permission-denied': 'Permission refusée.',
  'not-found': 'Document introuvable.',
  'already-exists': 'Ce document existe déjà.',
  'resource-exhausted': 'Quota dépassé. Réessayez plus tard.',
  'unavailable': 'Service temporairement indisponible.',
};

const FUNCTIONS_ERROR_MAP: Record<string, string> = {
  'not-found': 'Service indisponible. Réessayez plus tard.',
  'internal': 'Une erreur interne est survenue. Réessayez.',
  'unauthenticated': 'Connexion requise. Veuillez vous reconnecter.',
  'invalid-argument': 'Données invalides. Veuillez réessayer.',
  'deadline-exceeded': 'Délai dépassé. Vérifiez votre connexion.',
  'failed-precondition': 'Action impossible pour le moment. Réessayez.',
  'resource-exhausted': 'Trop de requêtes. Réessayez plus tard.',
};

export function translateFirebaseError(error: unknown): string {
  if (error instanceof Error) {
    const firebaseError = error as { code?: string };
    if (firebaseError.code) {
      const raw = firebaseError.code;
      const stripped = raw.replace(/^(functions|firestore|auth)\//, '');
      const message =
        AUTH_ERROR_MAP[stripped] ?? AUTH_ERROR_MAP[raw] ??
        FUNCTIONS_ERROR_MAP[stripped] ?? FUNCTIONS_ERROR_MAP[raw] ??
        FIRESTORE_ERROR_MAP[stripped] ?? FIRESTORE_ERROR_MAP[raw];
      if (message !== undefined) return message;
      return 'Une erreur est survenue. Réessayez.';
    }
    return error.message;
  }
  return 'Une erreur inattendue est survenue.';
}

// ─── Supabase (migration) ───

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
  if (error instanceof Error) {
    const e = error as { code?: string; message?: string };
    if (e.code) {
      const message = SUPABASE_AUTH_MAP[e.code] ?? POSTGREST_ERROR_MAP[e.code];
      if (message !== undefined) return message;
      return 'Une erreur est survenue. Réessayez.';
    }
    return e.message ?? 'Une erreur inattendue est survenue.';
  }
  return 'Une erreur inattendue est survenue.';
}
