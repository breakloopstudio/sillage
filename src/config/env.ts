// src/config/env.ts
// Configuration d'environnement — lit les variables EXPO_PUBLIC_*
// Ces variables sont définies dans le fichier .env à la racine du projet.
//
// Usage en développement local :
//   1. Copier .env.example → .env
//   2. Décommenter les lignes pour activer les émulateurs
//   3. Redémarrer le serveur Expo
//
// ⚠️  Pour connecter React Native aux émulateurs locaux,
//     remplacer "localhost" par l'IP de ta machine (ex: 192.168.1.42).
//     "localhost" sur un device Android pointe vers l'émulateur Android, pas ton PC.

export const env = {
  USE_EMULATORS: process.env.EXPO_PUBLIC_USE_EMULATORS === 'true',

  FIREBASE_AUTH_EMULATOR_HOST:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099',

  FIRESTORE_EMULATOR_HOST:
    process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_HOST || 'localhost:8080',

  FIREBASE_STORAGE_EMULATOR_HOST:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199',

  FIREBASE_FUNCTIONS_EMULATOR_HOST:
    process.env.EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST || 'localhost:5001',

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
