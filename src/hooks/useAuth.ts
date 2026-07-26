// src/hooks/useAuth.ts — Hook d'authentification Supabase
// Expose AppUser (uid/email/displayName/photoURL/providers) — compatible
// avec tous les écrans (profile, settings, delete-account, etc.).

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase, isSupabaseReady } from '../services/supabase';
import { translateSupabaseError } from '../utils/error-translator';

// ─── Type commun ─────────────────────────────────────────────────────────────

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  /** Liste des providers ('email', 'google') */
  providers?: readonly string[];
}

const AUTH_TIMEOUT_MS = 3000;

function suUserToAppUser(u: { id: string; email?: string | null; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }): AppUser {
  return {
    uid: u.id,
    email: (u.email as string) ?? null,
    displayName: (u.user_metadata?.full_name as string) ?? (u.email as string | null),
    photoURL: (u.user_metadata?.avatar_url as string) ?? null,
    providers: (u.app_metadata?.providers as string[] | undefined),
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isSupabaseReady()) {
      const t = setTimeout(() => setAuthReady(true), 100);
      return () => clearTimeout(t);
    }

    let resolved = false;
    const markReady = () => { if (!resolved) { resolved = true; setAuthReady(true); } };
    const timeout = setTimeout(markReady, AUTH_TIMEOUT_MS);

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const su = session?.user ?? null;
      setUser(su ? suUserToAppUser(su) : null);
      if (su) {
        try {
          const { data: adm } = await supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', su.id)
            .maybeSingle();
          setIsAdmin(adm !== null);
        } catch (e) { console.warn('[auth] admin check failed:', e); setIsAdmin(false); }
      } else {
        setIsAdmin(false);
      }
      markReady();
    });

    return () => { clearTimeout(timeout); data?.subscription.unsubscribe(); };
  }, []);

  // ── register ────────────────────────────────────────────────────────────────

  const register = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return { user: data.user ? suUserToAppUser(data.user as never) : null } as { user: AppUser };
    } catch (e) { throw new Error(translateSupabaseError(e)); }
  }, []);

  // ── login ───────────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { user: data.user ? suUserToAppUser(data.user as never) : null } as { user: AppUser };
    } catch (e) { throw new Error(translateSupabaseError(e)); }
  }, []);

  // ── loginWithGoogle ─────────────────────────────────────────────────────────

  const loginWithGoogle = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const signInResult = await GoogleSignin.signIn();
      if (signInResult.type === 'cancelled') {
        throw Object.assign(new Error('cancel'), { code: 'auth/cancelled' });
      }
      const idToken = signInResult.data?.idToken;
      if (!idToken) throw new Error('Google Sign-In annulé.');

      const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
      if (error) throw error;
      return { user: data.user ? suUserToAppUser(data.user as never) : null } as { user: AppUser };
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/cancelled') throw e;
      throw new Error(translateSupabaseError(e));
    }
  }, []);

  // ── logout ──────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    await supabase.auth.signOut().catch((e: unknown) => console.warn('[auth] signOut failed:', (e as Error)?.message ?? String(e)));
    try { await GoogleSignin.signOut(); } catch (e: unknown) { console.warn('[auth] GoogleSignin.signOut failed:', (e as Error)?.message ?? String(e)); }
  }, []);

  return {
    user,
    authReady,
    isAdmin,
    isAuthenticated: user !== null,
    register,
    login,
    loginWithGoogle,
    logout,
  };
}
