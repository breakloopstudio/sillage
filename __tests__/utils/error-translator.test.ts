import { translateSupabaseError } from '../../src/utils/error-translator';

describe('translateSupabaseError', () => {
  it('translates known gotrue auth codes', () => {
    const err = new Error('ignored') as Error & { code: string };

    err.code = 'invalid_credentials';
    expect(translateSupabaseError(err)).toBe('Email ou mot de passe incorrect.');

    err.code = 'email_not_confirmed';
    expect(translateSupabaseError(err)).toBe('Confirmez votre email avant de vous connecter.');

    err.code = 'user_not_found';
    expect(translateSupabaseError(err)).toBe('Aucun compte trouvé avec cet email.');

    err.code = 'email_exists';
    expect(translateSupabaseError(err)).toBe('Cet email est déjà utilisé.');

    err.code = 'weak_password';
    expect(translateSupabaseError(err)).toBe('Le mot de passe doit contenir au moins 6 caractères.');

    err.code = 'over_request_rate_limit';
    expect(translateSupabaseError(err)).toBe('Trop de tentatives. Réessayez plus tard.');

    err.code = 'session_not_found';
    expect(translateSupabaseError(err)).toBe('Session expirée. Reconnectez-vous.');

    err.code = 'reauthentication_needed';
    expect(translateSupabaseError(err)).toBe('Par sécurité, reconnectez-vous avant cette action.');

    err.code = 'network';
    expect(translateSupabaseError(err)).toBe('Problème de connexion réseau.');
  });

  it('translates known PostgREST / SQLSTATE codes', () => {
    const err = new Error('ignored') as Error & { code: string };

    err.code = '42501';
    expect(translateSupabaseError(err)).toBe('Permission refusée.');

    err.code = '23505';
    expect(translateSupabaseError(err)).toBe('Cet élément existe déjà.');

    err.code = '23503';
    expect(translateSupabaseError(err)).toBe('Référence introuvable.');

    err.code = 'PGRST116';
    expect(translateSupabaseError(err)).toBe('Élément introuvable.');

    err.code = 'PGRST301';
    expect(translateSupabaseError(err)).toBe('Connexion requise. Veuillez vous reconnecter.');
  });

  it('falls back to generic message for unknown codes', () => {
    const err = new Error('Custom error message') as Error & { code: string };
    err.code = 'some_unknown_code';
    expect(translateSupabaseError(err)).toBe('Une erreur est survenue. Réessayez.');
  });

  it('falls back to error.message if no code property', () => {
    const err = new Error('Simple error');
    expect(translateSupabaseError(err)).toBe('Simple error');
  });

  it('translates plain PostgREST error objects (real supabase-js shape)', () => {
    expect(translateSupabaseError({ code: '42501', message: 'new row violates' })).toBe('Permission refusée.');
    expect(translateSupabaseError({ code: 'PGRST301' })).toBe('Connexion requise. Veuillez vous reconnecter.');
    expect(translateSupabaseError({ code: 'invalid_credentials' })).toBe('Email ou mot de passe incorrect.');
  });

  it('falls back to generic message for non-Error values without code', () => {
    expect(translateSupabaseError('string error')).toBe('Une erreur inattendue est survenue.');
    expect(translateSupabaseError(null)).toBe('Une erreur inattendue est survenue.');
    expect(translateSupabaseError(undefined)).toBe('Une erreur inattendue est survenue.');
    expect(translateSupabaseError({ message: 'no code here' })).toBe('Une erreur inattendue est survenue.');
  });
});
