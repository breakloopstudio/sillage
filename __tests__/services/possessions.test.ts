import { supabase } from '../../src/services/supabase';
import {
  getPossessions, addPossession, updatePossession, removePossession,
} from '../../src/services/possessions';
import { chainMock } from '../helpers/supabase-chain';

const mockFrom = supabase.from as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getPossessions', () => {
  it('maps snake rows to Possession with numeric coercion', async () => {
    const chain = chainMock({
      data: [
        {
          id: 'pos1', parfum_id: 'p1', type: 'bottle', size_ml: '100',
          quantity: '2', for_sale: true, notes: 'n', added_at: '2026-07-01T10:00:00.000Z',
        },
        {
          id: 'pos2', parfum_id: 'p1', type: null, size_ml: null,
          quantity: null, for_sale: null, notes: null, added_at: null,
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const items = await getPossessions('uid1', 'p1');

    expect(mockFrom).toHaveBeenCalledWith('possessions');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'uid1');
    expect(chain.eq).toHaveBeenCalledWith('parfum_id', 'p1');
    expect(chain.order).toHaveBeenCalledWith('added_at', { ascending: true });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: 'pos1', parfumId: 'p1', type: 'bottle', sizeMl: 100,
      quantity: 2, forSale: true, notes: 'n',
    });
    expect(items[0].addedAt).toBeInstanceOf(Date);
    expect(items[1]).toMatchObject({
      type: 'bottle', sizeMl: null, quantity: 1, forSale: false, notes: null,
    });
    expect(items[1].addedAt).toBeInstanceOf(Date);
  });

  it('returns [] on error (soft-fail)', async () => {
    const chain = chainMock({ data: null, error: { message: 'boom' } });
    mockFrom.mockReturnValue(chain);
    await expect(getPossessions('uid1', 'p1')).resolves.toEqual([]);
  });
});

describe('addPossession', () => {
  it('inserts snake payload with defaults and returns id', async () => {
    const chain = chainMock({ data: { id: 'pos9' }, error: null });
    mockFrom.mockReturnValue(chain);

    const id = await addPossession('uid1', 'p1', 'decant');

    expect(mockFrom).toHaveBeenCalledWith('possessions');
    const arg = chain.insert.mock.calls[0][0];
    expect(arg.user_id).toBe('uid1');
    expect(arg.parfum_id).toBe('p1');
    expect(arg.type).toBe('decant');
    expect(arg.size_ml).toBeNull();
    expect(arg.quantity).toBe(1);
    expect(arg.for_sale).toBe(false);
    expect(arg.notes).toBeNull();
    expect(typeof arg.added_at).toBe('string');
    expect(chain.single).toHaveBeenCalled();
    expect(id).toBe('pos9');
  });

  it('forwards explicit values', async () => {
    const chain = chainMock({ data: { id: 'pos10' }, error: null });
    mockFrom.mockReturnValue(chain);

    await addPossession('uid1', 'p1', 'sample', 5, 3, true, 'échange');

    const arg = chain.insert.mock.calls[0][0];
    expect(arg.size_ml).toBe(5);
    expect(arg.quantity).toBe(3);
    expect(arg.for_sale).toBe(true);
    expect(arg.notes).toBe('échange');
  });

  it('rethrows on error', async () => {
    const chain = chainMock({ data: null, error: { message: 'boom' } });
    mockFrom.mockReturnValue(chain);
    await expect(addPossession('uid1', 'p1', 'bottle')).rejects.toBeTruthy();
  });
});

describe('updatePossession', () => {
  it('maps only provided fields to snake and scopes by owner', async () => {
    const chain = chainMock({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await updatePossession('uid1', 'pos1', { sizeMl: 50, forSale: true });

    expect(mockFrom).toHaveBeenCalledWith('possessions');
    expect(chain.update).toHaveBeenCalledWith({ size_ml: 50, for_sale: true });
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'uid1');
    expect(chain.eq).toHaveBeenCalledWith('id', 'pos1');
  });

  it('rethrows on error', async () => {
    const chain = chainMock({ data: null, error: { message: 'boom' } });
    mockFrom.mockReturnValue(chain);
    await expect(updatePossession('uid1', 'pos1', { quantity: 2 })).rejects.toBeTruthy();
  });
});

describe('removePossession', () => {
  it('deletes scoped by owner + id', async () => {
    const chain = chainMock({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await removePossession('uid1', 'pos1');

    expect(mockFrom).toHaveBeenCalledWith('possessions');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'uid1');
    expect(chain.eq).toHaveBeenCalledWith('id', 'pos1');
  });

  it('rethrows on error', async () => {
    const chain = chainMock({ data: null, error: { message: 'boom' } });
    mockFrom.mockReturnValue(chain);
    await expect(removePossession('uid1', 'pos1')).rejects.toBeTruthy();
  });
});
