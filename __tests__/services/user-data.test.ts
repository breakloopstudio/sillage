// __tests__/services/user-data.test.ts
// Tests CRUD favoris/scans/collection/settings (impl Supabase)

import { supabase } from '../../src/services/supabase';
import {
  addFavori, removeFavori, saveScan, removeScan,
  getUserSettings, updateUserSetting,
} from '../../src/services/user-data';
import type { Parfum } from '../../src/models';

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

// Chaîne de mock query builder
function chainMock(resolved: unknown = { data: null, error: null }) {
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('addFavori', () => {
  it('upserts favori with parfumId and filter fields', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    const parfum = {
      id: 'parfum_123', nom: 'Le Male', marque: 'JPG', imageUrl: 'img.jpg',
      familleOlactive: 'aromatic', bestPrice: 65, referencePrice: 90, annee: 1995,
      longevity: 'long lasting', sillage: 'moderate',
      seasonRanking: [{ name: 'summer', score: 70 }, { name: 'spring', score: 40 }],
      notesTete: ['vanilla', 'Mint'], notesCoeur: ['vanilla'], notesFond: [],
      createdAt: new Date(), updatedAt: new Date(),
    } as Parfum;

    const id = await addFavori('uid1', parfum);

    expect(mockFrom).toHaveBeenCalledWith('favoris');
    expect(chain.upsert).toHaveBeenCalled();
    const upsertArg = chain.upsert.mock.calls[0][0];
    expect(upsertArg.user_id).toBe('uid1');
    expect(upsertArg.parfum_id).toBe('parfum_123');
    expect(upsertArg.nom).toBe('Le Male');
    expect(upsertArg.best_price).toBe(65);
    expect(upsertArg.season_scores).toEqual({ summer: 70, spring: 40 });
    expect(upsertArg.notes).toEqual(['vanilla', 'mint']);
    expect(id).toBe('parfum_123');
  });

  it('stores nulls for missing fields', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    const parfum = { id: 'p2', marque: '', familleOlactive: '', notesTete: [], notesCoeur: [], notesFond: [], createdAt: new Date(), updatedAt: new Date() } as Parfum;
    await addFavori('uid1', parfum);
    const arg = chain.upsert.mock.calls[0][0];
    expect(arg.nom).toBeNull();
    expect(arg.best_price).toBeNull();
    expect(arg.longevity).toBeNull();
  });
});

describe('removeFavori', () => {
  it('deletes by user_id + parfum_id', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await removeFavori('uid1', 'parfum_123');
    expect(mockFrom).toHaveBeenCalledWith('favoris');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'uid1');
    expect(chain.eq).toHaveBeenCalledWith('parfum_id', 'parfum_123');
  });
});

describe('saveScan', () => {
  it('inserts scan with mapped fields', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await saveScan('uid1', { marque: 'Dior', nom: 'Sauvage', status: 'success', rawText: 'dior sauvage' } as never);
    expect(mockFrom).toHaveBeenCalledWith('scans');
    expect(chain.insert).toHaveBeenCalled();
    const arg = chain.insert.mock.calls[0][0];
    expect(arg.user_id).toBe('uid1');
    expect(arg.marque).toBe('Dior');
    expect(arg.status).toBe('success');
  });
});

describe('removeScan', () => {
  it('deletes by user_id + id', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await removeScan('uid1', 'scan-uuid');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'scan-uuid');
  });
});

describe('getUserSettings', () => {
  it('returns defaults when no row exists', async () => {
    const chain = chainMock({ data: null, error: null });
    mockFrom.mockReturnValue(chain);
    const settings = await getUserSettings('uid1');
    expect(settings).toEqual({ priceAlerts: false, pushNotifs: true, weatherNotifs: false, weatherLat: null, weatherLon: null });
  });

  it('maps snake_case row to settings', async () => {
    const chain = chainMock({ data: { price_alerts: true, push_notifs: false, weather_notifs: true, weather_lat: 48.85, weather_lon: 2.35 }, error: null });
    mockFrom.mockReturnValue(chain);
    const settings = await getUserSettings('uid1');
    expect(settings.priceAlerts).toBe(true);
    expect(settings.pushNotifs).toBe(false);
    expect(settings.weatherLat).toBe(48.85);
  });
});

describe('updateUserSetting', () => {
  it('upserts with mapped key', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await updateUserSetting('uid1', 'weatherNotifs', true);
    expect(chain.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'uid1', weather_notifs: true }));
  });
});
