// scripts/test-supabase-e2e.ts — Test end-to-end du backend Supabase (cloud)
// Simule exactement ce que l'app fait en mode USE_SUPABASE=true :
// recherche RPC (anon), signup, favoris, realtime postgres_changes, wardrobe,
// set_sotd, settings, personalized_suggestions. Cleanup : suppression du user test.
//
//   npx tsx scripts/test-supabase-e2e.ts

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

function readEnvVar(key: string): string {
  const content = fs.readFileSync(path.resolve('.env'), 'utf8');
  const m = content.match(new RegExp(`^${key}\\s*=\\s*(.+?)\\s*$`, 'm'));
  if (!m) throw new Error(`${key} manquant dans .env`);
  return m[1];
}

const URL = readEnvVar('EXPO_PUBLIC_SUPABASE_URL');
const ANON = readEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const SERVICE = readEnvVar('SUPABASE_SERVICE_ROLE_KEY');

const TEST_EMAIL = `e2e-${Date.now()}@gmail.com`;
const TEST_PASSWORD = 'E2e-Test-1234!';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) { passed++; console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function main(): Promise<void> {
  console.log('═══ Test E2E Supabase (cloud) ═══\n');

  // ─── 1. Anon : lecture catalogue publique ───
  console.log('1. Lecture publique (anon)');
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  {
    const { data, error } = await anon.from('parfums').select('id').limit(3);
    check('select parfums en anon', !error && (data?.length ?? 0) > 0, error?.message);

    const t = Date.now();
    const { data: search, error: sErr } = await anon.rpc('search_parfums', { q: 'chanel', max_results: 5 });
    check('RPC search_parfums("chanel")', !sErr && (search?.length ?? 0) > 0, `${Date.now() - t}ms, ${search?.length ?? 0} résultats${sErr ? `, ${sErr.message}` : ''}`);
    if (search?.[0]) console.log(`     → 1er: ${search[0].marque} ${search[0].nom}`);

    const { data: typo } = await anon.rpc('search_parfums', { q: 'chanell', max_results: 5 });
    check('typo "chanell" (trgm)', (typo?.length ?? 0) > 0, `${typo?.length ?? 0} résultats`);

    const { data: similar, error: simErr } = await anon.rpc('similar_parfums', { accords: ['fresh', 'spicy'], exclude_id: 'dior_sauvage', lim: 3 });
    check('RPC similar_parfums', !simErr && (similar?.length ?? 0) > 0, `${similar?.length ?? 0} résultats${simErr ? `, ${simErr.message}` : ''}`);
  }

  // ─── 2. Création user via Admin API (évite rate-limit SMTP + confirmation) ─
  console.log('\n2. Auth email');
  const user = createClient(URL, ANON, { auth: { persistSession: false } });
  let userId = '';
  {
    // Créer le user test via Admin API (email_confirm: true → pas d'email, pas de rate limit)
    const createRes = await fetch(`${URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE}`, 'apikey': SERVICE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true }),
    });
    check('create user (admin API)', createRes.ok, `HTTP ${createRes.status}`);
    if (createRes.ok) {
      const created = await createRes.json() as { id: string };
      userId = created.id;
    }

    // Login comme le ferait l'app (signInWithPassword)
    const { data: loginData, error: loginErr } = await user.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
    check('signInWithPassword', !loginErr && !!loginData.session, loginErr?.message);
    if (!userId && loginData.user) userId = loginData.user.id;
    check('user id récupéré', userId.length > 0, userId);
  }

  // ─── 3. Favoris (CRUD + RLS) ───
  console.log('\n3. Favoris (CRUD + RLS)');
  {
    const { error } = await user.from('favoris').upsert({
      user_id: userId, parfum_id: 'dior_sauvage', nom: 'Sauvage', marque: 'Dior',
      added_at: new Date().toISOString(),
    } as never);
    check('add favori', !error, error?.message);

    const { data, error: rErr } = await user.from('favoris').select('*').eq('user_id', userId);
    check('read favoris (RLS owner)', !rErr && data?.length === 1, `${data?.length ?? 0} ligne(s)`);

    // RLS négatif : un autre user_id ne doit rien voir
    const { data: others } = await user.from('favoris').select('*').eq('user_id', crypto.randomUUID());
    check('RLS : favoris d\'autrui invisibles', (others?.length ?? 0) === 0);
  }

  // ─── 4. Realtime postgres_changes ───
  console.log('\n4. Realtime postgres_changes');
  {
    // Utiliser le client `user` (session active) — le token est automatiquement
    // passé à la websocket realtime (pas besoin de setAuth manuel sur un client séparé)
    const eventReceived = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 20000);
      user.channel('e2e-favoris')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'favoris', filter: `user_id=eq.${userId}` }, () => {
          clearTimeout(timeout);
          resolve(true);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // Insérer APRÈS subscription confirmée
            await user.from('favoris').upsert({
              user_id: userId, parfum_id: 'chanel_no5', nom: 'N°5', marque: 'Chanel',
              added_at: new Date().toISOString(),
            } as never);
          }
        });
    });
    check('événement INSERT realtime reçu', await eventReceived);
    await user.removeAllChannels();
  }

  // ─── 5. Wardrobe + set_sotd (RPC transactionnelle) ───
  console.log('\n5. Wardrobe + SOTD');
  {
    const { error } = await user.from('wardrobe').upsert({
      user_id: userId, parfum_id: 'dior_sauvage', ownership: 'have',
      nom: 'Sauvage', marque: 'Dior', added_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as never);
    check('add wardrobe', !error, error?.message);

    const { error: sotdErr } = await user.rpc('set_sotd', { p_parfum_id: 'dior_sauvage', p_nom: 'Sauvage', p_marque: 'Dior' });
    check('RPC set_sotd', !sotdErr, sotdErr?.message);

    const { data: w } = await user.from('wardrobe').select('sotd_count').eq('user_id', userId).eq('parfum_id', 'dior_sauvage').single();
    check('sotd_count incrémenté (=1)', (w as { sotd_count: number } | null)?.sotd_count === 1, `=${(w as { sotd_count: number } | null)?.sotd_count}`);

    const { data: sotd } = await user.from('sotd').select('parfum_id').eq('user_id', userId);
    check('entrée sotd du jour écrite', (sotd?.length ?? 0) === 1);
  }

  // ─── 6. Settings + suggestions ───
  console.log('\n6. Settings + personalized_suggestions');
  {
    const { error } = await user.from('user_settings').upsert({ user_id: userId, price_alerts: true } as never);
    check('upsert user_settings', !error, error?.message);

    const { data } = await user.from('user_settings').select('price_alerts,push_notifs').eq('user_id', userId).single();
    check('read settings (défauts fusionnés)', (data as { price_alerts: boolean; push_notifs: boolean } | null)?.price_alerts === true);

    const { data: sugg, error: sErr } = await user.rpc('personalized_suggestions', { lim: 5 });
    check('RPC personalized_suggestions', !sErr, `${sugg?.length ?? 0} résultats${sErr ? `, ${sErr.message}` : ''}`);
  }

  // ─── 7. Export RGPD (RPC) ───
  console.log('\n7. Export RGPD');
  {
    const { data, error } = await user.rpc('export_user_data');
    const d = data as { collections?: { favoris?: unknown[]; wardrobe?: unknown[] } } | null;
    check('RPC export_user_data', !error && d?.collections !== undefined, error?.message);
    check('export contient favoris + wardrobe', (d?.collections?.favoris?.length ?? 0) >= 1 && (d?.collections?.wardrobe?.length ?? 0) >= 1);
  }

  // ─── 8. Cleanup : suppression du user test (admin API) ───
  console.log('\n8. Cleanup');
  {
    const res = await fetch(`${URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${SERVICE}`, 'apikey': SERVICE },
    });
    check('delete user (admin API)', res.ok, `HTTP ${res.status}`);

    // CASCADE : toutes les lignes user supprimées
    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const { data: fav } = await admin.from('favoris').select('parfum_id').eq('user_id', userId);
    const { data: war } = await admin.from('wardrobe').select('parfum_id').eq('user_id', userId);
    const { data: sotd } = await admin.from('sotd').select('day').eq('user_id', userId);
    check('CASCADE favoris', (fav?.length ?? 0) === 0);
    check('CASCADE wardrobe', (war?.length ?? 0) === 0);
    check('CASCADE sotd', (sotd?.length ?? 0) === 0);
  }

  console.log(`\n═══ Bilan : ${passed} passés, ${failed} échoués ═══`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('❌ E2E échoué :', (e as Error)?.message ?? e);
  process.exit(1);
});
