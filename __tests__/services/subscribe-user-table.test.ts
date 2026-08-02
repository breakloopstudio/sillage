import { supabase, subscribeUserTable } from '../../src/services/supabase';
import { chainMock } from '../helpers/supabase-chain';

const mockFrom = supabase.from as jest.Mock;
const mockChannel = supabase.channel as jest.Mock;
const mockRemoveChannel = supabase.removeChannel as jest.Mock;

interface Item { id: string; name: string; }

const mapRow = (row: Record<string, unknown>): Item => ({
  id: row.id as string,
  name: row.name as string,
});
const keyOf = (row: Record<string, unknown>): string => row.id as string;

function setupChannel() {
  let eventHandler: ((payload: Record<string, unknown>) => void) | null = null;
  let statusHandler: ((status: string) => void) | null = null;
  const ch = {
    on: jest.fn().mockImplementation((_evt: string, _filter: unknown, handler: (p: Record<string, unknown>) => void) => {
      eventHandler = handler;
      return ch;
    }),
    subscribe: jest.fn().mockImplementation((handler: (s: string) => void) => {
      statusHandler = handler;
      return ch;
    }),
  };
  mockChannel.mockReturnValue(ch);
  return {
    fireInsert: (row: Record<string, unknown>) => eventHandler!({ eventType: 'INSERT', new: row, old: {} }),
    fireUpdate: (row: Record<string, unknown>) => eventHandler!({ eventType: 'UPDATE', new: row, old: {} }),
    fireDelete: (row: Record<string, unknown>) => eventHandler!({ eventType: 'DELETE', new: {}, old: row }),
    fireStatus: (status: string) => statusHandler!(status),
    channel: ch,
  };
}

const flush = () => new Promise<void>(r => setTimeout(r, 0));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('subscribeUserTable', () => {
  it('fetches initial data and emits mapped items', async () => {
    const chain = chainMock({ data: [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }], error: null });
    mockFrom.mockReturnValue(chain);
    setupChannel();
    const cb = jest.fn();

    subscribeUserTable({ table: 'favoris' as never, userId: 'u1', mapRow, keyOf, cb });
    await flush();

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith([{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]);
    expect(mockFrom).toHaveBeenCalledWith('favoris');
  });

  it('applies sort when provided', async () => {
    const chain = chainMock({ data: [{ id: '2', name: 'Bob' }, { id: '1', name: 'Alice' }], error: null });
    mockFrom.mockReturnValue(chain);
    setupChannel();
    const cb = jest.fn();
    const sort = (a: Item, b: Item) => a.name.localeCompare(b.name);

    subscribeUserTable({ table: 'favoris' as never, userId: 'u1', mapRow, keyOf, sort, cb });
    await flush();

    expect(cb).toHaveBeenCalledWith([{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]);
  });

  it('INSERT event adds item and emits', async () => {
    const chain = chainMock({ data: [{ id: '1', name: 'Alice' }], error: null });
    mockFrom.mockReturnValue(chain);
    const { fireInsert } = setupChannel();
    const cb = jest.fn();

    subscribeUserTable({ table: 'favoris' as never, userId: 'u1', mapRow, keyOf, cb });
    await flush();
    cb.mockClear();

    fireInsert({ id: '3', name: 'Charlie' });
    expect(cb).toHaveBeenCalledWith([
      { id: '1', name: 'Alice' },
      { id: '3', name: 'Charlie' },
    ]);
  });

  it('UPDATE event replaces item in place', async () => {
    const chain = chainMock({ data: [{ id: '1', name: 'Alice' }], error: null });
    mockFrom.mockReturnValue(chain);
    const { fireUpdate } = setupChannel();
    const cb = jest.fn();

    subscribeUserTable({ table: 'favoris' as never, userId: 'u1', mapRow, keyOf, cb });
    await flush();
    cb.mockClear();

    fireUpdate({ id: '1', name: 'Alicia' });
    expect(cb).toHaveBeenCalledWith([{ id: '1', name: 'Alicia' }]);
  });

  it('DELETE event removes item', async () => {
    const chain = chainMock({ data: [{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }], error: null });
    mockFrom.mockReturnValue(chain);
    const { fireDelete } = setupChannel();
    const cb = jest.fn();

    subscribeUserTable({ table: 'favoris' as never, userId: 'u1', mapRow, keyOf, cb });
    await flush();
    cb.mockClear();

    fireDelete({ id: '1', name: 'Alice' });
    expect(cb).toHaveBeenCalledWith([{ id: '2', name: 'Bob' }]);
  });

  it('buffers events before initial fetch completes', async () => {
    let resolveFetch!: (v: unknown) => void;
    const fetchPromise = new Promise(r => { resolveFetch = r; });
    const chain: Record<string, unknown> = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      then: (resolve: (v: unknown) => void) => { fetchPromise.then(resolve); },
    };
    mockFrom.mockReturnValue(chain);
    const { fireInsert } = setupChannel();
    const cb = jest.fn();

    subscribeUserTable({ table: 'favoris' as never, userId: 'u1', mapRow, keyOf, cb });

    fireInsert({ id: '3', name: 'Charlie' });
    expect(cb).not.toHaveBeenCalled();

    resolveFetch({ data: [{ id: '1', name: 'Alice' }], error: null });
    await flush();

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith([
      { id: '1', name: 'Alice' },
      { id: '3', name: 'Charlie' },
    ]);
  });

  it('emits empty array and calls onError on fetch error', async () => {
    const chain = chainMock({ data: null, error: { message: 'RLS denied' } });
    mockFrom.mockReturnValue(chain);
    setupChannel();
    const cb = jest.fn();
    const onError = jest.fn();

    subscribeUserTable({ table: 'favoris' as never, userId: 'u1', mapRow, keyOf, cb, onError });
    await flush();

    expect(cb).toHaveBeenCalledWith([]);
    expect(onError).toHaveBeenCalledWith('RLS denied');
  });

  it('cleanup prevents further emissions and removes channel', async () => {
    const chain = chainMock({ data: [{ id: '1', name: 'Alice' }], error: null });
    mockFrom.mockReturnValue(chain);
    const { fireInsert, channel } = setupChannel();
    const cb = jest.fn();

    const unsub = subscribeUserTable({ table: 'favoris' as never, userId: 'u1', mapRow, keyOf, cb });
    await flush();
    cb.mockClear();

    unsub();
    fireInsert({ id: '2', name: 'Bob' });
    expect(cb).not.toHaveBeenCalled();
    expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
  });

  it('creates channel with correct filter', async () => {
    const chain = chainMock({ data: [], error: null });
    mockFrom.mockReturnValue(chain);
    const { channel } = setupChannel();

    subscribeUserTable({ table: 'favoris' as never, userId: 'u1', mapRow, keyOf, cb: jest.fn() });
    await flush();

    expect(mockChannel).toHaveBeenCalledWith(expect.stringContaining('user:favoris:u1:'));
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ event: '*', schema: 'public', table: 'favoris', filter: 'user_id=eq.u1' }),
      expect.any(Function),
    );
  });
});
