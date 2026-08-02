import { supabase } from '../../src/services/supabase';
import {
  addUserParfum, updateUserParfum, markTried, removeUserParfum, getUserParfum,
} from '../../src/services/user-parfum';
import type { Parfum } from '../../src/models';
import { chainMock } from '../helpers/supabase-chain';

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('addUserParfum', () => {
  it('upserts with status and display fields from parfum', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    const parfum = {
      id: 'p1', nom: 'Sauvage', marque: 'Dior', imageUrl: 'img.jpg',
      familleOlactive: 'woody', bestPrice: 89, referencePrice: 120,
      notesTete: ['bergamot'], notesCoeur: ['lavender'], notesFond: ['amber'],
      longevity: 'long', sillage: 'moderate', seasonRanking: [],
      createdAt: new Date(), updatedAt: new Date(),
    } as Parfum;
    await addUserParfum('uid1', 'p1', 'have', parfum);
    expect(mockFrom).toHaveBeenCalledWith('user_parfum');
    expect(chain.upsert).toHaveBeenCalled();
    const arg = chain.upsert.mock.calls[0][0];
    expect(arg.user_id).toBe('uid1');
    expect(arg.parfum_id).toBe('p1');
    expect(arg.status).toBe('have');
    expect(arg.nom).toBe('Sauvage');
    expect(arg.marque).toBe('Dior');
  });

  it('works without parfum argument (fetches internally)', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await addUserParfum('uid1', 'p1', 'to_try');
    expect(chain.upsert).toHaveBeenCalled();
    const arg = chain.upsert.mock.calls[0][0];
    expect(arg.status).toBe('to_try');
  });
});

describe('updateUserParfum', () => {
  it('updates only provided fields', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await updateUserParfum('uid1', 'p1', { status: 'want', rating: 4 });
    expect(chain.update).toHaveBeenCalled();
    const arg = chain.update.mock.calls[0][0];
    expect(arg.status).toBe('want');
    expect(arg.rating).toBe(4);
    expect(arg.updated_at).toBeDefined();
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'uid1');
    expect(chain.eq).toHaveBeenCalledWith('parfum_id', 'p1');
  });
});

describe('markTried', () => {
  it('sets status tried + verdict + tried_at', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await markTried('uid1', 'p1', { verdict: 'love', rating: 5, notes: 'Superbe' });
    expect(chain.update).toHaveBeenCalled();
    const arg = chain.update.mock.calls[0][0];
    expect(arg.status).toBe('tried');
    expect(arg.verdict).toBe('love');
    expect(arg.rating).toBe(5);
    expect(arg.notes).toBe('Superbe');
    expect(arg.tried_at).toBeDefined();
  });
});

describe('removeUserParfum', () => {
  it('deletes by user_id + parfum_id', async () => {
    const chain = chainMock();
    mockFrom.mockReturnValue(chain);
    await removeUserParfum('uid1', 'p1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'uid1');
    expect(chain.eq).toHaveBeenCalledWith('parfum_id', 'p1');
  });
});

describe('getUserParfum', () => {
  it('returns mapped UserParfum when row exists', async () => {
    const row = {
      parfum_id: 'p1', status: 'have', verdict: 'love', rating: 4.5,
      notes: 'Top', tried_at: '2026-07-01T10:00:00Z',
      shelf_ids: [], sotd_count: 3, is_signature: true,
      nom: 'Sauvage', marque: 'Dior', image_url: 'img.jpg',
      famille_olfactive: 'woody', best_price: 89, reference_price: 120,
      longevity: 'long', sillage: 'moderate', season_scores: null, all_notes: null,
      added_at: '2026-06-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z',
    };
    const chain = chainMock({ data: row, error: null });
    mockFrom.mockReturnValue(chain);
    const result = await getUserParfum('uid1', 'p1');
    expect(result).not.toBeNull();
    expect(result!.parfumId).toBe('p1');
    expect(result!.status).toBe('have');
    expect(result!.verdict).toBe('love');
    expect(result!.rating).toBe(4.5);
    expect(result!.isSignature).toBe(true);
    expect(result!.sotdCount).toBe(3);
  });

  it('returns null when no row', async () => {
    const chain = chainMock({ data: null, error: null });
    mockFrom.mockReturnValue(chain);
    const result = await getUserParfum('uid1', 'unknown');
    expect(result).toBeNull();
  });

  it('maps PostgREST numeric strings (rating/best_price/sotd_count) to numbers', async () => {
    const row = {
      parfum_id: 'p1', status: 'have', verdict: 'love', rating: '4.5',
      notes: null, tried_at: null, shelf_ids: [], sotd_count: '3', is_signature: false,
      nom: 'Sauvage', marque: 'Dior', image_url: null, famille_olfactive: null,
      best_price: '89.99', reference_price: '120',
      longevity: null, sillage: null, season_scores: null, all_notes: null,
      added_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z',
    };
    const chain = chainMock({ data: row, error: null });
    mockFrom.mockReturnValue(chain);
    const result = await getUserParfum('uid1', 'p1');
    expect(result!.rating).toBe(4.5);
    expect(result!.bestPrice).toBe(89.99);
    expect(result!.referencePrice).toBe(120);
    expect(result!.sotdCount).toBe(3);
  });
});
