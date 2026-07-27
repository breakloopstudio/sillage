import { renderHook, act } from '@testing-library/react-native';

jest.mock('../../src/services/user-data', () => ({
  onPriceAlerts: jest.fn(),
  setPriceAlert: jest.fn(),
}));

import { onPriceAlerts, setPriceAlert } from '../../src/services/user-data';
import { usePriceAlerts } from '../../src/hooks/usePriceAlerts';
import type { UserPriceAlert } from '../../src/models/user-price-alert.interface';

const mockOnPriceAlerts = onPriceAlerts as jest.Mock;
const mockSetPriceAlert = setPriceAlert as jest.Mock;

function makeAlert(parfumId: string): UserPriceAlert {
  return { parfumId, targetPrice: null, initialPrice: null, lastPrice: null, lastChecked: null, addedAt: new Date() };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePriceAlerts', () => {
  it('short-circuits when uid is null (no subscription)', () => {
    const { result } = renderHook(() => usePriceAlerts(null));
    expect(result.current.alerts).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockOnPriceAlerts).not.toHaveBeenCalled();
  });

  it('subscribes and indexes alerts by parfumId', () => {
    let cb: (alerts: UserPriceAlert[]) => void = () => {};
    mockOnPriceAlerts.mockImplementation((_uid: string, callback: (a: UserPriceAlert[]) => void) => {
      cb = callback;
      return () => {};
    });
    const { result } = renderHook(() => usePriceAlerts('uid1'));
    expect(mockOnPriceAlerts).toHaveBeenCalledWith('uid1', expect.any(Function));
    act(() => { cb([makeAlert('p1'), makeAlert('p2')]); });
    expect(result.current.loading).toBe(false);
    expect(result.current.alerts).toHaveLength(2);
    expect(result.current.byParfumId.has('p1')).toBe(true);
    expect(result.current.byParfumId.get('p2')?.parfumId).toBe('p2');
  });

  it('setAlert forwards to the service when authenticated', async () => {
    mockOnPriceAlerts.mockImplementation(() => () => {});
    mockSetPriceAlert.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePriceAlerts('uid1'));
    await act(async () => { await result.current.setAlert('p1', true, { targetPrice: 70 }); });
    expect(mockSetPriceAlert).toHaveBeenCalledWith('uid1', 'p1', true, { targetPrice: 70 });
  });

  it('setAlert is a no-op when uid is null', async () => {
    const { result } = renderHook(() => usePriceAlerts(null));
    await act(async () => { await result.current.setAlert('p1', true); });
    expect(mockSetPriceAlert).not.toHaveBeenCalled();
  });
});
