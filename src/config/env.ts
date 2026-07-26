// src/config/env.ts
// Configuration d'environnement — lit les variables EXPO_PUBLIC_*
// Ces variables sont définies dans le fichier .env à la racine du projet.

export const env = {
  // ─── Supabase (migration — cf. MIGRATION_SUPABASE.md) ───
  // Flag global de bascule Firebase → Supabase (rollback instantané tant que false)
  USE_SUPABASE: process.env.EXPO_PUBLIC_USE_SUPABASE === 'true',

  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',

  // Instance locale (supabase start) — utilisée si USE_SUPABASE_LOCAL=true
  USE_SUPABASE_LOCAL: process.env.EXPO_PUBLIC_USE_SUPABASE_LOCAL === 'true',
  SUPABASE_LOCAL_URL: 'http://127.0.0.1:54321',
  SUPABASE_LOCAL_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
} as const;
