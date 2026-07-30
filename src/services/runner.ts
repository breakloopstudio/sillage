// src/services/runner.ts — Leaderboard Flacon Runner (Supabase RPC)

import { supabase } from './supabase';

export interface LeaderboardEntry {
  rank: number;
  isMe: boolean;
  pseudo: string | null;
  avatarUrl: string | null;
  score: number;
  distance: number;
  maxCombo: number;
  skin: string;
  createdAt: string;
}

export interface ScoreSubmission {
  score: number;
  distance: number;
  maxCombo: number;
  skin: string;
}

export async function submitRunnerScore(input: ScoreSubmission): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('submit_runner_score', {
      p_score: Math.floor(input.score),
      p_distance: Math.floor(input.distance),
      p_max_combo: Math.floor(input.maxCombo),
      p_skin: input.skin,
    });
    if (error) throw error;
    return typeof data === 'number' ? data : null;
  } catch (e: unknown) {
    console.warn('[runner] submitRunnerScore failed:', (e as Error)?.message ?? String(e));
    return null;
  }
}

const CACHE_TTL = 5 * 60 * 1000;
let cached: { data: LeaderboardEntry[]; at: number } | null = null;

export async function getRunnerLeaderboard(limit = 100, force = false): Promise<LeaderboardEntry[]> {
  if (!force && cached && Date.now() - cached.at < CACHE_TTL) return cached.data;
  try {
    const { data, error } = await supabase.rpc('runner_leaderboard', { lim: limit });
    if (error) throw error;
    const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      rank: Number(row.rank ?? 0),
      isMe: row.is_me === true,
      pseudo: (row.pseudo as string) ?? null,
      avatarUrl: (row.avatar_url as string) ?? null,
      score: Number(row.score ?? 0),
      distance: Number(row.distance ?? 0),
      maxCombo: Number(row.max_combo ?? 0),
      skin: (row.skin as string) ?? 'default',
      createdAt: (row.created_at as string) ?? '',
    }));
    cached = { data: rows, at: Date.now() };
    return rows;
  } catch (e: unknown) {
    console.warn('[runner] getRunnerLeaderboard failed:', (e as Error)?.message ?? String(e));
    return cached?.data ?? [];
  }
}

export function clearRunnerLeaderboardCache(): void {
  cached = null;
}
