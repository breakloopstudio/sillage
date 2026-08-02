import { scoreWardrobeItemForWeather } from '../../src/utils/weather-scoring';
import type { UserParfum } from '../../src/models/user-parfum.interface';
import type { WeatherData } from '../../src/services/weather';

function makeItem(overrides: Partial<UserParfum> = {}): UserParfum {
  return {
    parfumId: 'p1', status: 'have', verdict: null, rating: null, notes: null,
    triedAt: null, shelfIds: [], sotdCount: 0, isSignature: false,
    nom: 'Test', marque: 'Brand', imageUrl: null, familleOlactive: null,
    addedAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function makeWeather(overrides: Partial<WeatherData> = {}): WeatherData {
  return {
    temperature: 22, weatherCode: 0, isDay: true,
    dailyMax: 25, dailyMin: 15, dailyWeatherCode: 0, fetchedAt: Date.now(),
    ...overrides,
  };
}

describe('scoreWardrobeItemForWeather', () => {
  it('scores citrus high in summer daytime sun', () => {
    const item = makeItem({ familleOlactive: 'citrus' });
    const weather = makeWeather({ dailyMax: 32, weatherCode: 0, isDay: true });
    const score = scoreWardrobeItemForWeather(item, weather);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('scores amber high in winter night snow', () => {
    const item = makeItem({ familleOlactive: 'amber' });
    const weather = makeWeather({ dailyMax: 2, weatherCode: 71, isDay: false });
    const score = scoreWardrobeItemForWeather(item, weather);
    expect(score).toBe(100);
  });

  it('scores citrus much lower in winter night than summer day', () => {
    const item = makeItem({ familleOlactive: 'citrus' });
    const winter = makeWeather({ dailyMax: 3, weatherCode: 71, isDay: false });
    const summer = makeWeather({ dailyMax: 32, weatherCode: 0, isDay: true });
    const winterScore = scoreWardrobeItemForWeather(item, winter);
    const summerScore = scoreWardrobeItemForWeather(item, summer);
    expect(winterScore).toBeLessThan(summerScore);
    expect(winterScore).toBeLessThan(50);
  });

  it('returns neutral score for unknown famille', () => {
    const item = makeItem({ familleOlactive: 'unknown_family' });
    const weather = makeWeather();
    const score = scoreWardrobeItemForWeather(item, weather);
    expect(score).toBe(50);
  });

  it('returns neutral score for null famille', () => {
    const item = makeItem({ familleOlactive: null });
    const weather = makeWeather();
    expect(scoreWardrobeItemForWeather(item, weather)).toBe(50);
  });

  it('normalizes French famille names', () => {
    const item = makeItem({ familleOlactive: 'hespéridé' });
    const weather = makeWeather({ dailyMax: 32, weatherCode: 0, isDay: true });
    const score = scoreWardrobeItemForWeather(item, weather);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('normalizes partial famille names', () => {
    const item = makeItem({ familleOlactive: 'boisée' });
    const weather = makeWeather({ dailyMax: 8, weatherCode: 3, isDay: false });
    const score = scoreWardrobeItemForWeather(item, weather);
    expect(score).toBeGreaterThan(50);
  });

  it('adds signature bonus', () => {
    const base = makeItem({ familleOlactive: 'floral' });
    const sig = makeItem({ familleOlactive: 'floral', isSignature: true });
    const weather = makeWeather();
    expect(scoreWardrobeItemForWeather(sig, weather))
      .toBeGreaterThan(scoreWardrobeItemForWeather(base, weather));
  });

  it('adds sotdCount bonus capped at 0.15', () => {
    const weather = makeWeather({ dailyMax: 32, weatherCode: 0, isDay: true });
    const s0 = scoreWardrobeItemForWeather(makeItem({ familleOlactive: 'woody', sotdCount: 0 }), weather);
    const s5 = scoreWardrobeItemForWeather(makeItem({ familleOlactive: 'woody', sotdCount: 5 }), weather);
    const s10 = scoreWardrobeItemForWeather(makeItem({ familleOlactive: 'woody', sotdCount: 10 }), weather);
    const s50 = scoreWardrobeItemForWeather(makeItem({ familleOlactive: 'woody', sotdCount: 50 }), weather);
    expect(s5).toBeGreaterThan(s0);
    expect(s10).toBeGreaterThan(s5);
    expect(s50).toBe(s10);
  });

  it('never exceeds 100', () => {
    const item = makeItem({ familleOlactive: 'amber', isSignature: true, sotdCount: 100 });
    const weather = makeWeather({ dailyMax: 0, weatherCode: 71, isDay: false });
    expect(scoreWardrobeItemForWeather(item, weather)).toBeLessThanOrEqual(100);
  });

  it('never goes below 0', () => {
    const item = makeItem({ familleOlactive: 'citrus' });
    const weather = makeWeather({ dailyMax: -10, weatherCode: 75, isDay: false });
    expect(scoreWardrobeItemForWeather(item, weather)).toBeGreaterThanOrEqual(0);
  });

  it('uses temperature as fallback when dailyMax is missing', () => {
    const item = makeItem({ familleOlactive: 'citrus' });
    const w1 = makeWeather({ dailyMax: 32, temperature: 10 });
    const w2 = makeWeather({ dailyMax: undefined as never, temperature: 32 });
    const s1 = scoreWardrobeItemForWeather(item, w1);
    const s2 = scoreWardrobeItemForWeather(item, w2);
    expect(s2).toBeGreaterThanOrEqual(s1 - 5);
  });

  it('falls back to WMO code 1 for unknown weather code', () => {
    const item = makeItem({ familleOlactive: 'floral' });
    const w1 = makeWeather({ weatherCode: 1 });
    const w2 = makeWeather({ weatherCode: 999 });
    expect(scoreWardrobeItemForWeather(item, w2))
      .toBe(scoreWardrobeItemForWeather(item, w1));
  });
});
