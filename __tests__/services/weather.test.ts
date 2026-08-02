import { fetchWeather } from '../../src/services/weather';

const mockFetch = jest.fn();
(global as Record<string, unknown>).fetch = mockFetch;

function apiResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: () => Promise.resolve({
      current: { time: '2026-07-15T12:00', temperature_2m: 22, weather_code: 0, is_day: 1 },
      daily: { time: ['2026-07-15'], temperature_2m_max: [28], temperature_2m_min: [16], weather_code: [1] },
      ...overrides,
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchWeather', () => {
  it('maps Open-Meteo response to WeatherData', async () => {
    mockFetch.mockResolvedValue(apiResponse());
    const w = await fetchWeather(48.85, 2.35, true);
    expect(w).not.toBeNull();
    expect(w!.temperature).toBe(22);
    expect(w!.weatherCode).toBe(0);
    expect(w!.isDay).toBe(true);
    expect(w!.dailyMax).toBe(28);
    expect(w!.dailyMin).toBe(16);
    expect(w!.dailyWeatherCode).toBe(1);
  });

  it('maps is_day 0 to false', async () => {
    mockFetch.mockResolvedValue(apiResponse({
      current: { time: 'T', temperature_2m: 15, weather_code: 3, is_day: 0 },
    }));
    const w = await fetchWeather(45.0, 5.0, true);
    expect(w!.isDay).toBe(false);
  });

  it('returns cached data on second call (same location)', async () => {
    mockFetch.mockResolvedValue(apiResponse());
    const w1 = await fetchWeather(10.0, 10.0, true);
    const w2 = await fetchWeather(10.0, 10.0);
    expect(w2).toBe(w1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('force bypasses cache', async () => {
    mockFetch.mockResolvedValue(apiResponse());
    await fetchWeather(20.0, 20.0, true);
    await fetchWeather(20.0, 20.0, true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent calls to same location', async () => {
    mockFetch.mockResolvedValue(apiResponse());
    const [w1, w2] = await Promise.all([
      fetchWeather(30.0, 30.0, true),
      fetchWeather(30.0, 30.0, true),
    ]);
    expect(w1).toBe(w2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns null on HTTP error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    expect(await fetchWeather(40.0, 40.0, true)).toBeNull();
  });

  it('returns null on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('network'));
    expect(await fetchWeather(50.0, 50.0, true)).toBeNull();
  });

  it('includes correct query params', async () => {
    mockFetch.mockResolvedValue(apiResponse());
    await fetchWeather(48.856, 2.352, true);
    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.get('latitude')).toBe('48.856');
    expect(url.searchParams.get('longitude')).toBe('2.352');
    expect(url.searchParams.get('forecast_days')).toBe('1');
  });
});
