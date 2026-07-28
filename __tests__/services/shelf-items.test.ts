import { supabase } from '../../src/services/supabase';
import {
  addToShelf, removeFromShelf, pinShelfItem, reorderShelfItems,
} from '../../src/services/user-parfum';

const mockRpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('shelf item RPCs', () => {
  it('addToShelf calls add_to_shelf with snake params', async () => {
    await addToShelf('uid1', 'p1', 's1');
    expect(mockRpc).toHaveBeenCalledWith('add_to_shelf', { p_shelf_id: 's1', p_parfum_id: 'p1' });
  });

  it('removeFromShelf calls remove_from_shelf', async () => {
    await removeFromShelf('uid1', 'p1', 's1');
    expect(mockRpc).toHaveBeenCalledWith('remove_from_shelf', { p_shelf_id: 's1', p_parfum_id: 'p1' });
  });

  it('pinShelfItem forwards p_pinned', async () => {
    await pinShelfItem('uid1', 's1', 'p1', true);
    expect(mockRpc).toHaveBeenCalledWith('pin_shelf_item', { p_shelf_id: 's1', p_parfum_id: 'p1', p_pinned: true });
  });

  it('reorderShelfItems maps items to snake p_items', async () => {
    await reorderShelfItems('uid1', 's1', [
      { parfumId: 'p1', position: 0, pinned: true },
      { parfumId: 'p2', position: 1, pinned: false },
    ]);
    expect(mockRpc).toHaveBeenCalledWith('reorder_shelf_items', {
      p_shelf_id: 's1',
      p_items: [
        { parfum_id: 'p1', position: 0, pinned: true },
        { parfum_id: 'p2', position: 1, pinned: false },
      ],
    });
  });

  it('rethrows on rpc error so the UI can rollback', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(addToShelf('uid1', 'p1', 's1')).rejects.toBeTruthy();
  });
});
