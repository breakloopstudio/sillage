// __tests__/services/account.test.ts
// Tests RGPD (impl Supabase : RPC + Edge Functions)

import { supabase } from '../../src/services/supabase';
import { getAccountDataSummary, deleteAllScans, deleteAllPriceAlerts, clearWeatherCoords } from '../../src/services/account';

const mockFrom = supabase.from as jest.Mock;

function chainMock(resolved: unknown = { data: null, error: null, count: 0 }) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit', 'maybeSingle', 'single'];
  for (const m of methods) {
    chain[m] = jest.fn().mockImplementation(() => {
      if (m === 'maybeSingle' || m === 'single') return Promise.resolve(resolved);
      return chain;
    });
  }
  chain.then = (resolve: (v: unknown) => void) => resolve(resolved);
  return chain;
}

beforeEach(() => { jest.clearAllMocks(); });

describe('getAccountDataSummary', () => {
  it('returns counts from 6 tables', async () => {
    const chain = chainMock({ data: null, error: null, count: 5 });
    mockFrom.mockReturnValue(chain);
    const summary = await getAccountDataSummary('uid1');
    expect(summary.favoris).toBe(5);
    expect(summary.wardrobe).toBe(5);
    expect(summary.scans).toBe(5);
    expect(summary.shelves).toBe(5);
    expect(summary.priceAlerts).toBe(5);
    expect(summary.sotdEntries).toBe(5);
    // 6 tables interrogées
    expect(mockFrom).toHaveBeenCalledTimes(6);
  });
});

describe('deleteAllScans', () => {
  it('deletes all scans for user and returns count', async () => {
    const chain = chainMock({ data: null, error: null, count: 12 });
    mockFrom.mockReturnValue(chain);
    const count = await deleteAllScans('uid1');
    expect(count).toBe(12);
    expect(mockFrom).toHaveBeenCalledWith('scans');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'uid1');
  });
});

describe('deleteAllPriceAlerts', () => {
  it('deletes all price alerts for user', async () => {
    const chain = chainMock({ data: null, error: null, count: 3 });
    mockFrom.mockReturnValue(chain);
    const count = await deleteAllPriceAlerts('uid1');
    expect(count).toBe(3);
    expect(mockFrom).toHaveBeenCalledWith('price_alerts');
  });
});

describe('clearWeatherCoords', () => {
  it('sets weather coords to null', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await clearWeatherCoords('uid1');
    expect(mockFrom).toHaveBeenCalledWith('user_settings');
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ weather_lat: null, weather_lon: null }));
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'uid1');
  });
});
