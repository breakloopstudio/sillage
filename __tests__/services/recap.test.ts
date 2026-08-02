import { supabase } from '../../src/services/supabase';
import { getSotdStreak, getWeeklyRecap } from '../../src/services/recap';
import { chainMock } from '../helpers/supabase-chain';

const mockFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getSotdStreak', () => {
  it('returns 0 when no entries', async () => {
    mockFrom.mockReturnValue(chainMock({ data: [], error: null }));
    expect(await getSotdStreak('u1')).toBe(0);
  });

  it('returns 1 for today only', async () => {
    mockFrom.mockReturnValue(chainMock({ data: [{ day: '2026-07-15' }], error: null }));
    expect(await getSotdStreak('u1')).toBe(1);
  });

  it('returns 1 for yesterday only (not yet set today)', async () => {
    mockFrom.mockReturnValue(chainMock({ data: [{ day: '2026-07-14' }], error: null }));
    expect(await getSotdStreak('u1')).toBe(1);
  });

  it('counts consecutive days ending today', async () => {
    mockFrom.mockReturnValue(chainMock({
      data: [{ day: '2026-07-15' }, { day: '2026-07-14' }, { day: '2026-07-13' }],
      error: null,
    }));
    expect(await getSotdStreak('u1')).toBe(3);
  });

  it('counts consecutive days ending yesterday', async () => {
    mockFrom.mockReturnValue(chainMock({
      data: [{ day: '2026-07-14' }, { day: '2026-07-13' }, { day: '2026-07-12' }, { day: '2026-07-11' }],
      error: null,
    }));
    expect(await getSotdStreak('u1')).toBe(4);
  });

  it('breaks streak on gap', async () => {
    mockFrom.mockReturnValue(chainMock({
      data: [{ day: '2026-07-15' }, { day: '2026-07-14' }, { day: '2026-07-12' }],
      error: null,
    }));
    expect(await getSotdStreak('u1')).toBe(2);
  });

  it('returns 0 if latest entry is older than yesterday', async () => {
    mockFrom.mockReturnValue(chainMock({
      data: [{ day: '2026-07-10' }, { day: '2026-07-09' }],
      error: null,
    }));
    expect(await getSotdStreak('u1')).toBe(0);
  });

  it('handles month boundary', async () => {
    jest.setSystemTime(new Date(2026, 6, 1, 12, 0, 0));
    mockFrom.mockReturnValue(chainMock({
      data: [{ day: '2026-07-01' }, { day: '2026-06-30' }, { day: '2026-06-29' }],
      error: null,
    }));
    expect(await getSotdStreak('u1')).toBe(3);
  });

  it('returns 0 on query error', async () => {
    mockFrom.mockReturnValue(chainMock({ data: null, error: { message: 'fail' } }));
    expect(await getSotdStreak('u1')).toBe(0);
  });
});

describe('getWeeklyRecap', () => {
  it('returns counts and total from 4 tables', async () => {
    const chain = chainMock({ data: null, error: null, count: 3 });
    mockFrom.mockReturnValue(chain);
    const recap = await getWeeklyRecap('u1');
    expect(recap.scans).toBe(3);
    expect(recap.favorites).toBe(3);
    expect(recap.daysWorn).toBe(3);
    expect(recap.verdicts).toBe(3);
    expect(recap.total).toBe(12);
    expect(mockFrom).toHaveBeenCalledTimes(4);
  });

  it('returns zeros when count is null', async () => {
    const chain = chainMock({ data: null, error: null, count: null });
    mockFrom.mockReturnValue(chain);
    const recap = await getWeeklyRecap('u1');
    expect(recap.total).toBe(0);
  });

  it('returns zeros on error (graceful degradation)', async () => {
    const chain = chainMock({ data: null, error: { message: 'fail' }, count: null });
    mockFrom.mockReturnValue(chain);
    const recap = await getWeeklyRecap('u1');
    expect(recap).toEqual({ scans: 0, favorites: 0, daysWorn: 0, verdicts: 0, total: 0 });
  });

  it('queries correct tables', async () => {
    const chain = chainMock({ data: null, error: null, count: 0 });
    mockFrom.mockReturnValue(chain);
    await getWeeklyRecap('u1');
    expect(mockFrom).toHaveBeenCalledWith('scans');
    expect(mockFrom).toHaveBeenCalledWith('favoris');
    expect(mockFrom).toHaveBeenCalledWith('sotd');
    expect(mockFrom).toHaveBeenCalledWith('user_parfum');
  });
});
