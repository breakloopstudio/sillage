import { renderHook, act } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { useWeather } from '../../src/hooks/useWeather';
import { fetchWeather } from '../../src/services/weather';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useFocusEffect: (cb: () => void) => { useEffect(() => { cb(); }, [cb]); },
  };
});

jest.mock('../../src/services/weather', () => ({
  fetchWeather: jest.fn(),
}));

const POSITION = {
  coords: { latitude: 48.8566, longitude: 2.3522, accuracy: 10 },
  timestamp: Date.now(),
};

describe('useWeather — jamais de prompt automatique', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue(POSITION);
    (fetchWeather as jest.Mock).mockResolvedValue({ temperature: 20, weatherCode: 0, isDay: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('load() ne demande JAMAIS la permission si undetermined (pas de prompt à froid)', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    renderHook(() => useWeather(true));

    await act(async () => { jest.advanceTimersByTime(1500); await Promise.resolve(); });

    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(fetchWeather).not.toHaveBeenCalled();
  });

  it('load() fetch la météo si la permission est déjà accordée', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted', canAskAgain: true });
    const { result } = renderHook(() => useWeather(true));

    await act(async () => { jest.advanceTimersByTime(1500); await Promise.resolve(); await Promise.resolve(); });

    expect(fetchWeather).toHaveBeenCalled();
    expect(result.current.weather).toBeTruthy();
  });

  it('load() ne fait rien si désactivé (enabled=false)', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted', canAskAgain: true });
    renderHook(() => useWeather(false));

    await act(async () => { jest.advanceTimersByTime(1500); await Promise.resolve(); });

    expect(fetchWeather).not.toHaveBeenCalled();
  });
});

describe('useWeather.requestPermission — geste explicite (fix A1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue(POSITION);
    (fetchWeather as jest.Mock).mockResolvedValue({ temperature: 20, weatherCode: 0, isDay: true });
  });

  it('fonctionne même quand enabled=false (le geste pose le consentement en parallèle)', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted', canAskAgain: true });
    const { result } = renderHook(() => useWeather(false));

    let ok = false;
    await act(async () => { ok = await result.current.requestPermission(); });

    expect(ok).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(fetchWeather).toHaveBeenCalled();
  });

  it('retourne true sans re-prompt si la permission est déjà accordée', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted', canAskAgain: true });
    const { result } = renderHook(() => useWeather(true));

    let ok = false;
    await act(async () => { ok = await result.current.requestPermission(); });

    expect(ok).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(fetchWeather).toHaveBeenCalled();
  });

  it('retourne false et oriente vers les réglages si refus définitif', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied', canAskAgain: false });
    const { result } = renderHook(() => useWeather(true));

    let ok = true;
    await act(async () => { ok = await result.current.requestPermission(); });

    expect(ok).toBe(false);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(result.current.error).toContain('réglages');
  });

  it('re-prompt si refus simple (canAskAgain=true)', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied', canAskAgain: true });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted', canAskAgain: true });
    const { result } = renderHook(() => useWeather(true));

    let ok = false;
    await act(async () => { ok = await result.current.requestPermission(); });

    expect(ok).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
  });
});

describe('useWeather — retrait du consentement (fix A2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (Location.getLastKnownPositionAsync as jest.Mock).mockResolvedValue(POSITION);
    (fetchWeather as jest.Mock).mockResolvedValue({ temperature: 20, weatherCode: 0, isDay: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('efface weather et coords quand enabled passe à false', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted', canAskAgain: true });
    const { result, rerender } = renderHook(({ enabled }) => useWeather(enabled), { initialProps: { enabled: true } });

    await act(async () => { jest.advanceTimersByTime(1500); await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.weather).toBeTruthy();
    expect(result.current.coords).toBeTruthy();

    rerender({ enabled: false });

    expect(result.current.weather).toBeNull();
    expect(result.current.coords).toBeNull();
  });
});
