// src/services/perf-votes.ts — Votes utilisateurs sur la performance olfactive
// (RPC parfum_perf : fusion Fragrantica borné + votes utilisateurs).

import { supabase } from './supabase';
import type { SeasonKey } from '../utils/season';

// TEMPORAIRE — parfum_perf / cast_vote ne sont pas encore dans database.types.ts
// (migration 0042 non déployée). Assertion ciblée sur la méthode rpc, à supprimer
// après `supabase gen types typescript --linked` post-déploiement.
type UntypedRpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;
// .bind(supabase) : supabase.rpc fait `this.rest.rpc(...)` — extraire la référence
// sans binder perd `this` et plante (« Cannot read property 'rest' of undefined »).
const rpcUntyped = supabase.rpc.bind(supabase) as unknown as UntypedRpc;

export type PerfVoteDimension = 'longevity' | 'sillage' | 'season' | 'moment';

export interface PerfDimensionResult {
  level: number | null;
  valueLabel: string | null;
  score: number | null;
  fragEquiv: number;
  userVotes: number;
  myVote: number | null;
}

export interface ParfumPerf {
  longevity: PerfDimensionResult;
  sillage: PerfDimensionResult;
  season: Record<string, number>;
  dayNight: Record<string, number>;
  seasonUserVotes: number;
  mySeason: SeasonKey | null;
  myMoment: 'day' | 'night' | null;
}

/** Profil de performance fusionné pour la fiche (RPC parfum_perf). null si indisponible. */
export async function getParfumPerf(parfumId: string, userId: string | null): Promise<ParfumPerf | null> {
  try {
    const { data, error } = await rpcUntyped('parfum_perf', { p_parfum_id: parfumId, p_user_id: userId });
    if (error) throw new Error(error.message);
    return (data as ParfumPerf | null) ?? null;
  } catch (e: unknown) {
    console.warn('[perf-votes] getParfumPerf failed:', (e as Error)?.message ?? String(e));
    return null;
  }
}

/** Vote / change (value) / retire (value = null). true si succès. */
export async function castVote(parfumId: string, dimension: PerfVoteDimension, value: string | null): Promise<boolean> {
  try {
    const { error } = await rpcUntyped('cast_vote', { p_parfum_id: parfumId, p_dimension: dimension, p_value: value });
    if (error) throw new Error(error.message);
    return true;
  } catch (e: unknown) {
    console.warn('[perf-votes] castVote failed:', (e as Error)?.message ?? String(e));
    return false;
  }
}
