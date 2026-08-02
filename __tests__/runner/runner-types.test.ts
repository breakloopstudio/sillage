import {
  checkAABB, getSpawnDistance, getPickupSpawnDistance,
  getDoubleObstacleChance, pickObstacleType,
  PICKUP_DEFS, OBSTACLE_DEFS, POWER_DURATION, SKINS,
  MAX_LIVES, FEVER_DURATION, FEVER_MAX, SLOW_FACTOR,
  BOTTLE_WIDTH, BOTTLE_HEIGHT, OBSTACLE_HITBOX_INSET,
  BOTTLE_HITBOX_INSET_TOP, BOTTLE_HITBOX_INSET_SIDE,
} from '../../src/features/runner/runner-types';
import { SKINS as STORAGE_SKINS } from '../../src/features/runner/runner-storage';

describe('checkAABB', () => {
  it('detects overlapping rectangles', () => {
    expect(checkAABB(0, 0, 10, 10, 5, 5, 10, 10)).toBe(true);
  });

  it('returns false for non-overlapping (right)', () => {
    expect(checkAABB(0, 0, 10, 10, 20, 0, 10, 10)).toBe(false);
  });

  it('returns false for non-overlapping (above)', () => {
    expect(checkAABB(0, 0, 10, 10, 0, 20, 10, 10)).toBe(false);
  });

  it('returns false for edge-touching rectangles (not overlapping)', () => {
    expect(checkAABB(0, 0, 10, 10, 10, 0, 10, 10)).toBe(false);
    expect(checkAABB(0, 0, 10, 10, 0, 10, 10, 10)).toBe(false);
  });

  it('detects containment', () => {
    expect(checkAABB(0, 0, 100, 100, 25, 25, 10, 10)).toBe(true);
  });

  it('detects partial overlap on one axis only', () => {
    expect(checkAABB(0, 0, 10, 10, 5, 0, 10, 10)).toBe(true);
    expect(checkAABB(0, 0, 10, 10, 0, 5, 10, 10)).toBe(true);
  });

  it('applies hitbox insets correctly (bottle vs obstacle)', () => {
    const bx = 50, by = 100;
    const ox = 50 + BOTTLE_WIDTH - OBSTACLE_HITBOX_INSET - BOTTLE_HITBOX_INSET_SIDE - 1;
    const oy = 100;
    const bw = BOTTLE_WIDTH - BOTTLE_HITBOX_INSET_SIDE * 2;
    const bh = BOTTLE_HEIGHT - BOTTLE_HITBOX_INSET_TOP;
    const ow = OBSTACLE_DEFS[0].width - OBSTACLE_HITBOX_INSET;
    const oh = OBSTACLE_DEFS[0].height;
    expect(checkAABB(bx + BOTTLE_HITBOX_INSET_SIDE, by, bw, bh, ox, oy, ow, oh)).toBe(true);
  });
});

describe('getSpawnDistance', () => {
  it('returns at least 180', () => {
    for (let i = 0; i < 50; i++) {
      expect(getSpawnDistance(10000)).toBeGreaterThanOrEqual(180);
    }
  });

  it('decreases with score', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const low = getSpawnDistance(0);
    const high = getSpawnDistance(5000);
    expect(high).toBeLessThan(low);
    jest.restoreAllMocks();
  });

  it('stays in expected range at score 0', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(getSpawnDistance(0)).toBe(300);
    jest.spyOn(Math, 'random').mockReturnValue(1);
    expect(getSpawnDistance(0)).toBe(450);
    jest.restoreAllMocks();
  });
});

describe('getPickupSpawnDistance', () => {
  it('returns at least 350', () => {
    for (let i = 0; i < 50; i++) {
      expect(getPickupSpawnDistance(10000)).toBeGreaterThanOrEqual(350);
    }
  });

  it('decreases with score', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const low = getPickupSpawnDistance(0);
    const high = getPickupSpawnDistance(5000);
    expect(high).toBeLessThan(low);
    jest.restoreAllMocks();
  });
});

describe('getDoubleObstacleChance', () => {
  it('returns 0 below 500', () => {
    expect(getDoubleObstacleChance(0)).toBe(0);
    expect(getDoubleObstacleChance(499)).toBe(0);
  });

  it('increases in tiers', () => {
    expect(getDoubleObstacleChance(500)).toBe(0.15);
    expect(getDoubleObstacleChance(1000)).toBe(0.3);
    expect(getDoubleObstacleChance(1500)).toBe(0.45);
    expect(getDoubleObstacleChance(2000)).toBe(0.55);
    expect(getDoubleObstacleChance(9999)).toBe(0.55);
  });
});

describe('pickObstacleType', () => {
  it('returns ground shards (0-3) at low score', () => {
    for (let i = 0; i < 30; i++) {
      const t = pickObstacleType(100);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(3);
    }
  });

  it('can return bee (4) above 300', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.30);
    expect(pickObstacleType(301)).toBe(4);
    jest.restoreAllMocks();
  });

  it('can return drop (5) above 600', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.10);
    expect(pickObstacleType(601)).toBe(5);
    jest.restoreAllMocks();
  });

  it('never returns bee below 300', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.30);
    expect(pickObstacleType(299)).toBeLessThanOrEqual(3);
    jest.restoreAllMocks();
  });
});

describe('constants coherence', () => {
  it('has 4 pickup defs with unique keys and powers', () => {
    expect(PICKUP_DEFS).toHaveLength(4);
    const keys = new Set(PICKUP_DEFS.map(p => p.key));
    const powers = new Set(PICKUP_DEFS.map(p => p.power));
    expect(keys.size).toBe(4);
    expect(powers.size).toBe(4);
  });

  it('has a power duration for each power type', () => {
    for (const p of PICKUP_DEFS) {
      expect(POWER_DURATION[p.power]).toBeDefined();
    }
  });

  it('has 6 obstacle defs', () => {
    expect(OBSTACLE_DEFS).toHaveLength(6);
  });

  it('has exactly one airborne and one falling obstacle', () => {
    expect(OBSTACLE_DEFS.filter(o => o.airborne)).toHaveLength(1);
    expect(OBSTACLE_DEFS.filter(o => o.falling)).toHaveLength(1);
  });

  it('has 3 lives', () => {
    expect(MAX_LIVES).toBe(3);
  });

  it('fever duration is positive and max is 100', () => {
    expect(FEVER_DURATION).toBeGreaterThan(0);
    expect(FEVER_MAX).toBe(100);
  });

  it('slow factor is between 0 and 1', () => {
    expect(SLOW_FACTOR).toBeGreaterThan(0);
    expect(SLOW_FACTOR).toBeLessThan(1);
  });

  it('bottle hitbox insets are smaller than bottle dimensions', () => {
    expect(BOTTLE_HITBOX_INSET_SIDE * 2).toBeLessThan(BOTTLE_WIDTH);
    expect(BOTTLE_HITBOX_INSET_TOP).toBeLessThan(BOTTLE_HEIGHT);
  });

  it('SKINS thresholds are ascending', () => {
    for (let i = 1; i < STORAGE_SKINS.length; i++) {
      expect(STORAGE_SKINS[i].threshold).toBeGreaterThan(STORAGE_SKINS[i - 1].threshold);
    }
  });
});
