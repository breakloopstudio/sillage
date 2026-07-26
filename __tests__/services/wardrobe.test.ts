// __tests__/services/wardrobe.test.ts
// Tests wardrobe/shelves/SOTD (impl Supabase)

import { supabase } from '../../src/services/supabase';
import {
  addToWardrobe, updateWardrobeItem, removeFromWardrobe, isInWardrobe,
  createShelf, deleteShelf, getTodaySotd, setSotd,
} from '../../src/services/wardrobe';

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

beforeEach(() => { jest.clearAllMocks(); });

describe('addToWardrobe', () => {
  it('inserts new wardrobe item with ownership and defaults', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await addToWardrobe('uid1', 'parfum_1', 'have', 'Sauvage', 'Dior', 'img.jpg', 'aromatic');
    expect(mockFrom).toHaveBeenCalledWith('wardrobe');
    expect(chain.insert).toHaveBeenCalled();
    const arg = chain.insert.mock.calls[0][0];
    expect(arg.user_id).toBe('uid1');
    expect(arg.parfum_id).toBe('parfum_1');
    expect(arg.ownership).toBe('have');
    expect(arg.nom).toBe('Sauvage');
    expect(arg.rating).toBeNull();
    expect(arg.shelf_ids).toEqual([]);
    expect(arg.sotd_count).toBe(0);
  });

  it('updates ownership only for existing item (preserves user data)', async () => {
    const parfumChain = chainMock({ data: null, error: null });
    const insertChain = chainMock({ data: null, error: { code: '23505', message: 'duplicate key' } });
    const updateChain = chainMock();
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return parfumChain;
      if (callCount === 2) return insertChain;
      return updateChain;
    });
    await addToWardrobe('uid1', 'parfum_1', 'want');
    expect(insertChain.insert).toHaveBeenCalled();
    expect(updateChain.update).toHaveBeenCalled();
    const arg = updateChain.update.mock.calls[0][0];
    expect(arg.ownership).toBe('want');
    expect(arg.rating).toBeUndefined();
    expect(arg.notes).toBeUndefined();
    expect(arg.shelf_ids).toBeUndefined();
    expect(arg.sotd_count).toBeUndefined();
    expect(arg.is_signature).toBeUndefined();
  });
});

describe('updateWardrobeItem', () => {
  it('updates only provided fields + updated_at', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await updateWardrobeItem('uid1', 'parfum_1', { rating: 4, notes: 'Top' });
    expect(chain.update).toHaveBeenCalled();
    const arg = chain.update.mock.calls[0][0];
    expect(arg.rating).toBe(4);
    expect(arg.notes).toBe('Top');
    expect(arg.updated_at).toBeDefined();
    expect(arg.ownership).toBeUndefined();
  });
});

describe('removeFromWardrobe', () => {
  it('deletes by user_id + parfum_id', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await removeFromWardrobe('uid1', 'parfum_1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('parfum_id', 'parfum_1');
  });
});

describe('isInWardrobe', () => {
  it('returns mapped WardrobeItem when found', async () => {
    const chain = chainMock({
      data: { parfum_id: 'p1', nom: 'Test', marque: 'M', ownership: 'have', rating: 3, sotd_count: 2, is_signature: true, shelf_ids: ['s1'], added_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' },
      error: null,
    });
    mockFrom.mockReturnValue(chain);
    const item = await isInWardrobe('uid1', 'p1');
    expect(item).not.toBeNull();
    expect(item!.parfumId).toBe('p1');
    expect(item!.rating).toBe(3);
    expect(item!.sotdCount).toBe(2);
    expect(item!.isSignature).toBe(true);
    expect(item!.shelfIds).toEqual(['s1']);
  });

  it('returns null when not found', async () => {
    const chain = chainMock({ data: null, error: null });
    mockFrom.mockReturnValue(chain);
    expect(await isInWardrobe('uid1', 'nope')).toBeNull();
  });
});

describe('createShelf', () => {
  it('inserts shelf with incremented order', async () => {
    // Premier appel : select max order → [{order: 2}]
    const selectChain = chainMock();
    selectChain.order.mockReturnValue(selectChain);
    selectChain.limit.mockResolvedValue({ data: [{ order: 2 }], error: null });
    // Deuxième appel : insert
    const insertChain = chainMock();
    insertChain.select.mockReturnValue(insertChain);
    insertChain.single.mockResolvedValue({ data: { id: 'shelf-uuid' }, error: null });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? selectChain : insertChain;
    });

    const id = await createShelf('uid1', 'Été', 'sun', '#FFD700');
    expect(id).toBe('shelf-uuid');
    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'uid1', name: 'Été', icon: 'sun', color: '#FFD700', order: 3,
    }));
  });
});

describe('deleteShelf', () => {
  it('calls RPC delete_shelf', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await deleteShelf('uid1', 'shelf-1');
    expect(mockRpc).toHaveBeenCalledWith('delete_shelf', { p_shelf_id: 'shelf-1' });
  });
});

describe('getTodaySotd', () => {
  it('returns SotdEntry when found', async () => {
    const chain = chainMock({ data: { parfum_id: 'p1', nom: 'Sauvage', marque: 'Dior', image_url: 'img.jpg' }, error: null });
    mockFrom.mockReturnValue(chain);
    const sotd = await getTodaySotd('uid1');
    expect(sotd).toEqual({ parfumId: 'p1', nom: 'Sauvage', marque: 'Dior', imageUrl: 'img.jpg' });
  });

  it('returns null when no SOTD today', async () => {
    const chain = chainMock({ data: null, error: null });
    mockFrom.mockReturnValue(chain);
    expect(await getTodaySotd('uid1')).toBeNull();
  });
});

describe('setSotd', () => {
  it('calls RPC set_sotd', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await setSotd('uid1', 'p1', 'Sauvage', 'Dior', 'img.jpg');
    expect(mockRpc).toHaveBeenCalledWith('set_sotd', {
      p_parfum_id: 'p1', p_nom: 'Sauvage', p_marque: 'Dior', p_image_url: 'img.jpg',
    });
  });
});
