import { supabase } from './supabase';

export interface CommunityParfum {
  parfum_id: string;
  nom: string | null;
  marque: string | null;
  image_url: string | null;
  famille_olfactive: string | null;
  best_price: number | null;
  love_count?: number;
  activity_count?: number;
}

export interface CommunityProfile {
  pseudo: string;
  avatar_url: string | null;
  bio: string | null;
  collection_count: number;
  top_images: string[];
}

export interface CommunitySotd {
  pseudo: string;
  avatar_url: string | null;
  parfum_id: string;
  nom: string;
  marque: string;
  image_url: string | null;
}

export interface CommunityHighlights {
  top_loved: CommunityParfum[];
  trending: CommunityParfum[];
  public_profiles: CommunityProfile[];
  sotd_today: CommunitySotd[];
}

const CACHE_TTL = 60 * 60 * 1000;
let cached: { data: CommunityHighlights; at: number } | null = null;

export async function getCommunityHighlights(): Promise<CommunityHighlights> {
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data;

  const { data, error } = await supabase.rpc('community_highlights');
  if (error) throw error;

  const raw = (data ?? {}) as Record<string, unknown>;
  const result: CommunityHighlights = {
    top_loved: (raw.top_loved ?? []) as CommunityParfum[],
    trending: (raw.trending ?? []) as CommunityParfum[],
    public_profiles: (raw.public_profiles ?? []) as CommunityProfile[],
    sotd_today: (raw.sotd_today ?? []) as CommunitySotd[],
  };

  cached = { data: result, at: Date.now() };
  return result;
}

export function clearCommunityCache(): void {
  cached = null;
}

export interface ParfumVerdict {
  pseudo: string;
  avatar_url: string | null;
  verdict: 'love' | 'like' | 'meh' | 'dislike';
}

export async function getParfumVerdicts(parfumId: string): Promise<ParfumVerdict[]> {
  try {
    const { data, error } = await supabase.rpc('parfum_verdicts', { p_parfum_id: parfumId });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      pseudo: (row.pseudo as string) ?? '',
      avatar_url: (row.avatar_url as string) ?? null,
      verdict: (row.verdict as ParfumVerdict['verdict']) ?? 'like',
    }));
  } catch (e: unknown) {
    console.warn('[community] getParfumVerdicts failed:', (e as Error)?.message ?? String(e));
    return [];
  }
}

export async function followByPseudo(pseudo: string): Promise<void> {
  const { error } = await supabase.rpc('follow_by_pseudo', { p_pseudo: pseudo });
  if (error) throw error;
}

export async function unfollowByPseudo(pseudo: string): Promise<void> {
  const { error } = await supabase.rpc('unfollow_by_pseudo', { p_pseudo: pseudo });
  if (error) throw error;
}

export async function isFollowing(pseudo: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_following', { p_pseudo: pseudo });
    if (error) throw error;
    return data === true;
  } catch (e: unknown) {
    console.warn('[community] isFollowing failed:', (e as Error)?.message ?? String(e));
    return false;
  }
}

export interface FollowEntry {
  pseudo: string;
  avatar_url: string | null;
}

export async function getPublicFollowers(pseudo: string, limit = 20): Promise<FollowEntry[]> {
  try {
    const { data, error } = await supabase.rpc('public_followers', { p_pseudo: pseudo, lim: limit });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      pseudo: (row.pseudo as string) ?? '',
      avatar_url: (row.avatar_url as string) ?? null,
    }));
  } catch (e: unknown) {
    console.warn('[community] getPublicFollowers failed:', (e as Error)?.message ?? String(e));
    return [];
  }
}

export async function getPublicFollowing(pseudo: string, limit = 20): Promise<FollowEntry[]> {
  try {
    const { data, error } = await supabase.rpc('public_following', { p_pseudo: pseudo, lim: limit });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      pseudo: (row.pseudo as string) ?? '',
      avatar_url: (row.avatar_url as string) ?? null,
    }));
  } catch (e: unknown) {
    console.warn('[community] getPublicFollowing failed:', (e as Error)?.message ?? String(e));
    return [];
  }
}

export interface FollowedVerdict {
  pseudo: string;
  avatar_url: string | null;
  parfum_id: string;
  nom: string | null;
  marque: string | null;
  image_url: string | null;
  verdict: 'love' | 'like' | 'meh' | 'dislike';
  updated_at: string;
}

export interface FollowedHave {
  pseudo: string;
  avatar_url: string | null;
  parfum_id: string;
  nom: string | null;
  marque: string | null;
  image_url: string | null;
  added_at: string;
}

export interface FollowedHighlights {
  sotd_today: CommunitySotd[];
  recent_verdicts: FollowedVerdict[];
  new_have: FollowedHave[];
}

export async function getFollowedHighlights(): Promise<FollowedHighlights | null> {
  try {
    const { data, error } = await supabase.rpc('followed_highlights');
    if (error) throw error;
    const raw = (data ?? {}) as Record<string, unknown>;
    return {
      sotd_today: (raw.sotd_today ?? []) as CommunitySotd[],
      recent_verdicts: (raw.recent_verdicts ?? []) as FollowedVerdict[],
      new_have: (raw.new_have ?? []) as FollowedHave[],
    };
  } catch (e: unknown) {
    console.warn('[community] getFollowedHighlights failed:', (e as Error)?.message ?? String(e));
    return null;
  }
}
