import { translateFirebaseError } from '../../src/utils/error-translator';

describe('translateFirebaseError', () => {
  it('translates known auth error codes', () => {
    const err = new Error('ignored') as Error & { code: string };
    err.code = 'auth/email-already-in-use';
    expect(translateFirebaseError(err)).toBe('Cet email est déjà utilisé.');

    err.code = 'auth/invalid-email';
    expect(translateFirebaseError(err)).toBe("L'adresse email n'est pas valide.");

    err.code = 'auth/user-not-found';
    expect(translateFirebaseError(err)).toBe('Aucun compte trouvé avec cet email.');

    err.code = 'auth/wrong-password';
    expect(translateFirebaseError(err)).toBe('Mot de passe incorrect.');

    err.code = 'auth/invalid-credential';
    expect(translateFirebaseError(err)).toBe('Email ou mot de passe incorrect.');

    err.code = 'auth/weak-password';
    expect(translateFirebaseError(err)).toBe('Le mot de passe doit contenir au moins 6 caractères.');

    err.code = 'auth/too-many-requests';
    expect(translateFirebaseError(err)).toBe('Trop de tentatives. Réessayez plus tard.');

    err.code = 'auth/requires-recent-login';
    expect(translateFirebaseError(err)).toBe('Par sécurité, reconnectez-vous avant cette action.');

    err.code = 'auth/user-mismatch';
    expect(translateFirebaseError(err)).toBe("Les identifiants ne correspondent pas à ce compte.");
  });

  it('translates known Firestore error codes', () => {
    const err = new Error('ignored') as Error & { code: string };
    err.code = 'permission-denied';
    expect(translateFirebaseError(err)).toBe('Permission refusée.');

    // 'not-found' existe dans les deux maps Firestore et Functions.
    // L'ordre de priorite dans le code : AUTH > FUNCTIONS > FIRESTORE.
    // Donc 'not-found' renvoie le message Functions, pas Firestore.
    err.code = 'not-found';
    expect(translateFirebaseError(err)).toBe('Service indisponible. Réessayez plus tard.');
  });

  it('translates known Functions error codes', () => {
    const err = new Error('ignored') as Error & { code: string };
    err.code = 'internal';
    expect(translateFirebaseError(err)).toBe('Une erreur interne est survenue. Réessayez.');

    err.code = 'unauthenticated';
    expect(translateFirebaseError(err)).toBe('Connexion requise. Veuillez vous reconnecter.');

    err.code = 'failed-precondition';
    expect(translateFirebaseError(err)).toBe('Action impossible pour le moment. Réessayez.');

    err.code = 'resource-exhausted';
    expect(translateFirebaseError(err)).toBe('Trop de requêtes. Réessayez plus tard.');
  });

  it('handles prefixed error codes (functions/, firestore/, auth/)', () => {
    const err = new Error('ignored') as Error & { code: string };

    err.code = 'functions/failed-precondition';
    expect(translateFirebaseError(err)).toBe('Action impossible pour le moment. Réessayez.');

    err.code = 'functions/resource-exhausted';
    expect(translateFirebaseError(err)).toBe('Trop de requêtes. Réessayez plus tard.');

    err.code = 'functions/unauthenticated';
    expect(translateFirebaseError(err)).toBe('Connexion requise. Veuillez vous reconnecter.');

    err.code = 'firestore/permission-denied';
    expect(translateFirebaseError(err)).toBe('Permission refusée.');

    err.code = 'auth/user-not-found';
    expect(translateFirebaseError(err)).toBe('Aucun compte trouvé avec cet email.');
  });

  it('returns empty string for auth/cancelled', () => {
    const err = new Error('ignored') as Error & { code: string };
    err.code = 'auth/cancelled';
    expect(translateFirebaseError(err)).toBe('');
  });

  it('falls back to generic message if code is unknown', () => {
    const err = new Error('Custom error message') as Error & { code: string };
    err.code = 'auth/some-unknown-code';
    expect(translateFirebaseError(err)).toBe('Une erreur est survenue. Réessayez.');
  });

  it('falls back to generic message for non-Error values', () => {
    expect(translateFirebaseError('string error')).toBe('Une erreur inattendue est survenue.');
    expect(translateFirebaseError(null)).toBe('Une erreur inattendue est survenue.');
    expect(translateFirebaseError(undefined)).toBe('Une erreur inattendue est survenue.');
    expect(translateFirebaseError({ code: 'auth/email-already-in-use' })).toBe('Une erreur inattendue est survenue.');
  });

  it('falls back to error.message if code property does not exist', () => {
    const err = new Error('Simple error');
    expect(translateFirebaseError(err)).toBe('Simple error');
  });
});
