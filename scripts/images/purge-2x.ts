/**
 * Purge des images HD 2x — libère le quota Storage Supabase (plan Free 1 GB).
 *
 * Les 2x (`primary_2x.webp`, ~1,7-2 GB au total) sont le seul vrai levier de
 * stockage. Ce script supprime les fichiers du bucket `parfum-images` et remet
 * `image_url_2x` à NULL en base. L'UI retombe proprement sur la 1x (overlay
 * optionnel dans ImageViewerPopup / DetailHero).
 *
 * RÉGÉNÉRABLE : tout parfum avec image_url_2x NULL est repris automatiquement
 * par `npm run migrate-upscale` si on veut restaurer les HD plus tard.
 *
 * Resumable : chaque lot traité passe image_url_2x à NULL → un re-run ne
 * sélectionne que le reste. Idempotent.
 *
 * DESTRUCTIF : dry-run PAR DÉFAUT (comme backfill-*). Ajouter --write pour
 * exécuter réellement la purge.
 *
 * Usage:
 *   npm run tsx scripts/images/purge-2x.ts                    # simulation (défaut)
 *   npm run tsx scripts/images/purge-2x.ts -- --write         # exécute
 *   npm run tsx scripts/images/purge-2x.ts -- --write --limit=50  # test sur 50
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readEnvVar, argValue, hasFlag } from '../lib/script-utils';

const BUCKET = 'parfum-images';
const BATCH = 200;

const write = hasFlag('write');
const dryRun = !write;
const limitArg = parseInt(argValue('limit') ?? '0', 10) || 0;

const url = readEnvVar('EXPO_PUBLIC_SUPABASE_URL');
const serviceKey = readEnvVar('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceKey) {
  console.error('Variables EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes dans .env');
  process.exit(1);
}
const supabase: SupabaseClient = createClient(url, serviceKey);

async function main() {
  const { count } = await supabase
    .from('parfums')
    .select('*', { count: 'exact', head: true })
    .not('image_url_2x', 'is', null);
  console.log(`${dryRun ? '[DRY-RUN] ' : ''}${count ?? 0} parfums avec image_url_2x à purger.`);
  if (dryRun) {
    console.log('[DRY-RUN] Aucune modification effectuée. Relancez avec --write pour exécuter.');
    return;
  }

  let done = 0;
  let failed = 0;
  for (;;) {
    if (limitArg > 0 && done >= limitArg) break;
    const remaining = limitArg > 0 ? limitArg - done : BATCH;
    const batchSize = Math.min(BATCH, remaining);

    const { data, error } = await supabase
      .from('parfums')
      .select('id')
      .not('image_url_2x', 'is', null)
      .limit(batchSize);
    if (error) throw error;
    const ids = (data ?? []).map((r) => r.id as string);
    if (ids.length === 0) break;

    const paths = ids.map((id) => `parfums/${id}/primary_2x.webp`);
    const rm = await supabase.storage.from(BUCKET).remove(paths);
    if (rm.error) {
      failed += ids.length;
      console.warn(`  remove échec: ${rm.error.message} — base NON réinitialisée pour ce lot (re-run possible).`);
      break;
    }

    const up = await supabase.from('parfums').update({ image_url_2x: null }).in('id', ids);
    if (up.error) {
      failed += ids.length;
      console.warn(`  update échec: ${up.error.message} — objets Storage déjà supprimés.`);
      break;
    }

    done += ids.length;
    console.log(`  ${done} traités`);
  }

  console.log(`Terminé : ${done} traités, ${failed} en échec. Stockage libéré ≈ ${(done * 74 / 1024 / 1024).toFixed(2)} GB (estimé).`);
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
