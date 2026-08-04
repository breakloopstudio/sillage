// __tests__/services/user-data.test.ts
// Tests CRUD favoris/scans/collection/settings (impl Supabase)

import { supabase } from '../../src/services/supabase';
import * as supabaseCore from '../../src/services/supabase';
import {
  addFavori, removeFavori, saveScan, removeScan,
  getUserSettings, updateUserSetting,
  setPriceAlert, getLowestObservedPrice, getLowestObservedPrices,
} from '../../src/services/user-data';
import type { Parfum } from '../../src/models';
import { chainMock } from '../helpers/supabase-chain';

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

// Les variables EXPO_PUBLIC_* ne sont pas injectées en environnement jest.
jest.spyOn(supabaseCore, 'isSupabaseReady').mockReturnValue(true);

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
    await saveScan('uid1', { marque: 'Dior', nom: 'Sauvage', status: 'success', rawText: 'dior sauvage' });
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

describe('setPriceAlert', () => {
  it('upserts with initial_price + target_price when activating with opts', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await setPriceAlert('uid1', 'p1', true, { currentPrice: 80, targetPrice: 70 });
    expect(mockFrom).toHaveBeenCalledWith('price_alerts');
    const arg = chain.upsert.mock.calls[0][0];
    expect(arg.user_id).toBe('uid1');
    expect(arg.parfum_id).toBe('p1');
    expect(arg.initial_price).toBe(80);
    expect(arg.last_price).toBe(80);
    expect(arg.target_price).toBe(70);
  });

  it('upserts with null target/initial when no opts', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await setPriceAlert('uid1', 'p1', true);
    const arg = chain.upsert.mock.calls[0][0];
    expect(arg.target_price).toBeNull();
    expect(arg.initial_price).toBeNull();
  });

  it('deletes when deactivating', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await setPriceAlert('uid1', 'p1', false);
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'uid1');
    expect(chain.eq).toHaveBeenCalledWith('parfum_id', 'p1');
  });

  it('updates only target_price on edit (does not re-anchor initial/last price)', async () => {
    const chain = chainMock({ data: { parfum_id: 'p1' }, error: null });
    mockFrom.mockReturnValue(chain);
    await setPriceAlert('uid1', 'p1', true, { currentPrice: 999, targetPrice: 60 });
    expect(chain.maybeSingle).toHaveBeenCalled();
    expect(chain.update).toHaveBeenCalled();
    expect(chain.upsert).not.toHaveBeenCalled();
    const arg = chain.update.mock.calls[0][0];
    expect(arg.target_price).toBe(60);
    expect(arg).not.toHaveProperty('initial_price');
    expect(arg).not.toHaveProperty('last_price');
  });
});

describe('getLowestObservedPrice', () => {
  it('returns the lowest price as a number (PostgREST numeric string coerced)', async () => {
    const chain = chainMock({ data: { best_price: '64.5' }, error: null });
    mockFrom.mockReturnValue(chain);
    const result = await getLowestObservedPrice('p1');
    expect(result).toBe(64.5);
    expect(chain.order).toHaveBeenCalledWith('best_price', { ascending: true });
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it('returns null when no history', async () => {
    const chain = chainMock({ data: null, error: null });
    mockFrom.mockReturnValue(chain);
    expect(await getLowestObservedPrice('p1')).toBeNull();
  });
});

describe('getLowestObservedPrices', () => {
  it('returns the min best_price per parfum across rows', async () => {
    const chain = chainMock({
      data: [
        { parfum_id: 'p1', best_price: '80.00' },
        { parfum_id: 'p1', best_price: '64.5' },
        { parfum_id: 'p2', best_price: '120' },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(chain);
    const result = await getLowestObservedPrices(['p1', 'p2']);
    expect(mockFrom).toHaveBeenCalledWith('price_history');
    expect(chain.in).toHaveBeenCalledWith('parfum_id', ['p1', 'p2']);
    expect(result.get('p1')).toBe(64.5);
    expect(result.get('p2')).toBe(120);
    expect(result.size).toBe(2);
  });

  it('returns an empty map without querying on empty input', async () => {
    const result = await getLowestObservedPrices([]);
    expect(result.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns an empty map on error', async () => {
    const chain = chainMock({ data: null, error: new Error('boom') });
    mockFrom.mockReturnValue(chain);
    const result = await getLowestObservedPrices(['p1']);
    expect(result.size).toBe(0);
  });
});
