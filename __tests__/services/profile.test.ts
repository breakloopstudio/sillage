import { supabase } from '../../src/services/supabase';
import {
  getMyProfile, upsertMyProfile, getPublicProfile, getPublicCollection,
  getPublicShelf, getPublicShelfItems,
} from '../../src/services/profile';

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

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

describe('getMyProfile', () => {
  it('returns mapped profile when a row exists', async () => {
    const chain = chainMock({ data: { pseudo: 'john', avatar_url: 'a.jpg', bio: 'hello', is_public: true, created_at: '2026-01-01T00:00:00Z' }, error: null });
    mockFrom.mockReturnValue(chain);
    const p = await getMyProfile('uid1');
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(p?.pseudo).toBe('john');
    expect(p?.isPublic).toBe(true);
    expect(p?.bio).toBe('hello');
    expect(p?.avatarUrl).toBe('a.jpg');
  });

  it('returns null when no row', async () => {
    const chain = chainMock({ data: null, error: null });
    mockFrom.mockReturnValue(chain);
    expect(await getMyProfile('uid1')).toBeNull();
  });
});

describe('upsertMyProfile', () => {
  it('upserts pseudo/bio/is_public/avatar_url', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await upsertMyProfile('uid1', { pseudo: 'john', bio: 'hi', isPublic: true, avatarUrl: 'a.jpg' });
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    const arg = chain.upsert.mock.calls[0][0];
    expect(arg.user_id).toBe('uid1');
    expect(arg.pseudo).toBe('john');
    expect(arg.bio).toBe('hi');
    expect(arg.is_public).toBe(true);
    expect(arg.avatar_url).toBe('a.jpg');
  });

  it('defaults bio null / is_public false when omitted', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await upsertMyProfile('uid1', { pseudo: 'john' });
    const arg = chain.upsert.mock.calls[0][0];
    expect(arg.bio).toBeNull();
    expect(arg.is_public).toBe(false);
    expect(arg.avatar_url).toBeNull();
  });

  it('rethrows on error so the UI can translate code 23505 (pseudo pris)', async () => {
    const chain = chainMock({ data: null, error: { code: '23505', message: 'duplicate key' } });
    mockFrom.mockReturnValue(chain);
    await expect(upsertMyProfile('uid1', { pseudo: 'taken' })).rejects.toBeTruthy();
  });
});

describe('getPublicProfile', () => {
  it('maps the RPC row (collection_count numeric string coerced)', async () => {
    mockRpc.mockResolvedValue({ data: [{ pseudo: 'john', avatar_url: null, bio: 'bio', created_at: '2026-01-01T00:00:00Z', collection_count: '12' }], error: null });
    const p = await getPublicProfile('john');
    expect(mockRpc).toHaveBeenCalledWith('public_profile', { p_pseudo: 'john' });
    expect(p?.pseudo).toBe('john');
    expect(p?.collectionCount).toBe(12);
  });

  it('returns null for a private/unknown profile (empty RPC result)', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    expect(await getPublicProfile('ghost')).toBeNull();
  });
});

describe('getPublicCollection', () => {
  it('maps RPC rows (rating/best_price numeric strings coerced)', async () => {
    mockRpc.mockResolvedValue({ data: [
      { parfum_id: 'p1', nom: 'Sauvage', marque: 'Dior', image_url: null, famille_olfactive: 'woody', status: 'have', verdict: 'love', rating: '4.5', best_price: '89.99', added_at: '2026-01-01T00:00:00Z' },
    ], error: null });
    const items = await getPublicCollection('john');
    expect(mockRpc).toHaveBeenCalledWith('public_collection', { p_pseudo: 'john' });
    expect(items).toHaveLength(1);
    expect(items[0].parfumId).toBe('p1');
    expect(items[0].rating).toBe(4.5);
    expect(items[0].bestPrice).toBe(89.99);
    expect(items[0].status).toBe('have');
    expect(items[0].verdict).toBe('love');
  });

  it('returns [] on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await getPublicCollection('john')).toEqual([]);
  });
});

describe('getPublicShelf', () => {
  it('maps the RPC row (item_count numeric string coerced)', async () => {
    mockRpc.mockResolvedValue({ data: [{ shelf_id: 's1', name: 'Boisés', description: 'd', color: '#fff', icon: 'leaf', item_count: '7', pseudo: 'john', avatar_url: null, bio: 'b' }], error: null });
    const sh = await getPublicShelf('john', 's1');
    expect(mockRpc).toHaveBeenCalledWith('public_shelf', { p_pseudo: 'john', p_shelf_id: 's1' });
    expect(sh?.shelfId).toBe('s1');
    expect(sh?.name).toBe('Boisés');
    expect(sh?.itemCount).toBe(7);
    expect(sh?.pseudo).toBe('john');
  });

  it('returns null for a private/unknown shelf (empty RPC result)', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    expect(await getPublicShelf('john', 'nope')).toBeNull();
  });
});

describe('getPublicShelfItems', () => {
  it('maps RPC rows (best_price numeric string coerced; notes perso absentes)', async () => {
    mockRpc.mockResolvedValue({ data: [
      { parfum_id: 'p1', nom: 'Sauvage', marque: 'Dior', image_url: null, famille_olfactive: 'woody', best_price: '89.99' },
    ], error: null });
    const items = await getPublicShelfItems('john', 's1');
    expect(mockRpc).toHaveBeenCalledWith('public_shelf_items', { p_pseudo: 'john', p_shelf_id: 's1' });
    expect(items).toHaveLength(1);
    expect(items[0].parfumId).toBe('p1');
    expect(items[0].nom).toBe('Sauvage');
    expect(items[0].familleOlactive).toBe('woody');
    expect(items[0].bestPrice).toBe(89.99);
  });

  it('returns [] on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await getPublicShelfItems('john', 's1')).toEqual([]);
  });
});
