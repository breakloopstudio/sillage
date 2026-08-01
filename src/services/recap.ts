import { supabase } from './supabase';
import { today } from './impl/sql-utils';

export interface WeeklyRecap {
  scans: number;
  favorites: number;
  daysWorn: number;
  verdicts: number;
  total: number;
}

function dayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDayStr(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return dayStr(dt);
}

export async function getSotdStreak(uid: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('sotd')
      .select('day')
      .eq('user_id', uid)
      .order('day', { ascending: false })
      .limit(366);
    if (error) throw error;
    const days = (data ?? []).map((r) => (r as { day: string }).day);
    if (days.length === 0) return 0;
    const todayStr = today();
    if (days[0] !== todayStr && days[0] !== prevDayStr(todayStr)) return 0;
    let streak = 1;
    let expected = prevDayStr(days[0]);
    for (let i = 1; i < days.length; i++) {
      if (days[i] === expected) {
        streak++;
        expected = prevDayStr(expected);
      } else {
        break;
      }
    }
    return streak;
  } catch (e: unknown) {
    console.warn('[recap] getSotdStreak failed:', (e as Error)?.message ?? String(e));
    return 0;
  }
}

type HeadCountResult = { count: number | null; error: { message?: string } | null };

export async function getWeeklyRecap(uid: string): Promise<WeeklyRecap> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 6);
  const sinceDay = dayStr(since);
  const sinceIso = since.toISOString();

  const safe = async (run: () => Promise<HeadCountResult>): Promise<number> => {
    try {
      const { count, error } = await run();
      if (error) {
        console.warn('[recap] weekly count failed:', error.message);
        return 0;
      }
      return count ?? 0;
    } catch (e: unknown) {
      console.warn('[recap] weekly count threw:', (e as Error)?.message ?? String(e));
      return 0;
    }
  };

  const [scans, favorites, daysWorn, verdicts] = await Promise.all([
    safe(() => supabase.from('scans').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('scanned_at', sinceIso) as unknown as Promise<HeadCountResult>),
    safe(() => supabase.from('favoris').select('parfum_id', { count: 'exact', head: true }).eq('user_id', uid).gte('added_at', sinceIso) as unknown as Promise<HeadCountResult>),
    safe(() => supabase.from('sotd').select('day', { count: 'exact', head: true }).eq('user_id', uid).gte('day', sinceDay) as unknown as Promise<HeadCountResult>),
    safe(() => supabase.from('user_parfum').select('parfum_id', { count: 'exact', head: true }).eq('user_id', uid).not('verdict', 'is', null).gte('tried_at', sinceIso) as unknown as Promise<HeadCountResult>),
  ]);

  return { scans, favorites, daysWorn, verdicts, total: scans + favorites + daysWorn + verdicts };
}
