// scripts/test-supabase-e2e.ts — Test end-to-end du backend Supabase (cloud)
// Simule exactement ce que l'app fait en mode USE_SUPABASE=true :
// recherche RPC (anon), signup, favoris, realtime postgres_changes, user_parfum,
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

    // Login comme le ferait l'app (signInWithPassword) — retente avec backoff :
    // gotrue rate-limit les sign-in par IP (runs rapprochés, CI sur IP « chaude »).
    // En usage normal (1 run) la boucle fait 1 itération → aucun ralentissement.
    type SignInRes = Awaited<ReturnType<typeof user.auth.signInWithPassword>>;
    let loginRes: SignInRes = await user.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
    for (let attempt = 1; attempt < 4 && (loginRes.error || !loginRes.data.session); attempt++) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      loginRes = await user.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
    }
    check('signInWithPassword', !loginRes.error && !!loginRes.data.session, loginRes.error?.message ?? '');
    if (!userId && loginRes.data.user) userId = loginRes.data.user.id;
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
    const eventReceived = new Promise<boolean>((resolve) => {
      let done = false;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = (v: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (retryTimer) clearTimeout(retryTimer);
        resolve(v);
      };
      const timer = setTimeout(() => finish(false), 45000);
      const insert = (parfumId: string, nom: string) => {
        void user.from('favoris').upsert({
          user_id: userId, parfum_id: parfumId, nom, marque: 'Chanel',
          added_at: new Date().toISOString(),
        } as never).then(({ error }) => {
          if (error) console.log(`     insert ${parfumId} échoué : ${error.message}`);
        });
      };
      user.channel(`e2e-favoris-${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'favoris', filter: `user_id=eq.${userId}` }, () => finish(true))
        .subscribe(async (status, err) => {
          if (err) console.log(`     channel : ${status} — ${String(err)}`);
          if (status === 'SUBSCRIBED') {
            setTimeout(() => insert('chanel_no5', 'N°5'), 2000);
            retryTimer = setTimeout(() => {
              if (done) return;
              insert('chanel_allure', 'Allure');
            }, 8000);
          }
        });
    });
    check('événement INSERT realtime reçu', await eventReceived);
    await user.removeAllChannels();
  }

  // ─── 5. Wardrobe + set_sotd (RPC transactionnelle) ───
  console.log('\n5. User_parfum + SOTD');
  {
    const { error } = await user.from('user_parfum').upsert({
      user_id: userId, parfum_id: 'dior_sauvage', status: 'have',
      nom: 'Sauvage', marque: 'Dior', added_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as never);
    check('add user_parfum', !error, error?.message);

    const { error: sotdErr } = await user.rpc('set_sotd', { p_parfum_id: 'dior_sauvage', p_nom: 'Sauvage', p_marque: 'Dior' });
    check('RPC set_sotd', !sotdErr, sotdErr?.message);

    const { data: up } = await user.from('user_parfum').select('sotd_count').eq('user_id', userId).eq('parfum_id', 'dior_sauvage').single();
    check('sotd_count incrémenté (=1)', (up as { sotd_count: number } | null)?.sotd_count === 1, `=${(up as { sotd_count: number } | null)?.sotd_count}`);

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
    const d = data as { collections?: { favoris?: unknown[]; userParfum?: unknown[] } } | null;
    check('RPC export_user_data', !error && d?.collections !== undefined, error?.message);
    check('export contient favoris + user_parfum', (d?.collections?.favoris?.length ?? 0) >= 1 && (d?.collections?.userParfum?.length ?? 0) >= 1);
  }

  // ─── 8. Votes performance (cast_vote + parfum_perf) ───
  console.log('\n8. Votes performance (5 crans longévité)');
  {
    const { error } = await user.rpc('cast_vote', { p_parfum_id: 'dior_sauvage', p_dimension: 'longevity', p_value: '5' });
    check('cast_vote longevity=5', !error, error?.message);

    const { data: perf } = await user.rpc('parfum_perf', { p_parfum_id: 'dior_sauvage' });
    const pl = (perf as { longevity?: { myVote?: number | null; level?: number | null } } | null)?.longevity;
    check('parfum_perf myVote=5 + level 1..5', pl?.myVote === 5 && (pl?.level === null || (pl.level >= 1 && pl.level <= 5)), `myVote=${pl?.myVote}, level=${pl?.level}`);

    const { error: e6 } = await user.rpc('cast_vote', { p_parfum_id: 'dior_sauvage', p_dimension: 'longevity', p_value: '6' });
    check('cast_vote longevity=6 refusé', !!e6, e6?.message ?? '');

    const { error: es5 } = await user.rpc('cast_vote', { p_parfum_id: 'dior_sauvage', p_dimension: 'sillage', p_value: '5' });
    check('cast_vote sillage=5 refusé', !!es5, es5?.message ?? '');

    const { error: eNull } = await user.rpc('cast_vote', { p_parfum_id: 'dior_sauvage', p_dimension: 'longevity', p_value: null });
    const { data: perf2 } = await user.rpc('parfum_perf', { p_parfum_id: 'dior_sauvage' });
    const pl2 = (perf2 as { longevity?: { myVote?: number | null } } | null)?.longevity;
    check('cast_vote null retire le vote', !eNull && pl2?.myVote === null, `myVote=${pl2?.myVote}`);
  }

  // ─── 9. Cleanup : suppression du user test (admin API) ───
  console.log('\n9. Cleanup');
  {
    const res = await fetch(`${URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${SERVICE}`, 'apikey': SERVICE },
    });
    check('delete user (admin API)', res.ok, `HTTP ${res.status}`);

    // CASCADE : toutes les lignes user supprimées
    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
    const { data: fav } = await admin.from('favoris').select('parfum_id').eq('user_id', userId);
    const { data: up } = await admin.from('user_parfum').select('parfum_id').eq('user_id', userId);
    const { data: sotd } = await admin.from('sotd').select('day').eq('user_id', userId);
    check('CASCADE favoris', (fav?.length ?? 0) === 0);
    check('CASCADE user_parfum', (up?.length ?? 0) === 0);
    check('CASCADE sotd', (sotd?.length ?? 0) === 0);
  }

  console.log(`\n═══ Bilan : ${passed} passés, ${failed} échoués ═══`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('❌ E2E échoué :', (e as Error)?.message ?? e);
  process.exit(1);
});
