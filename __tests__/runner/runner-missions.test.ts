import { evaluateMissionTiers, nextObjective, MISSIONS, type MissionContext } from '../../src/features/runner/runner-missions';

function ctx(over: Partial<MissionContext> = {}): MissionContext {
  return {
    score: 0, distance: 0, maxCombo: 0, nearMiss: 0, shieldBreaks: 0, notesCollected: 0,
    totalRuns: 0, totalDistance: 0, totalNotes: 0, ...over,
  };
}

describe('evaluateMissionTiers', () => {
  it('returns newly reached tiers vs an empty state', () => {
    const fresh = evaluateMissionTiers(ctx({ score: 600 }), {});
    expect(fresh.find(f => f.mission.key === 'score')?.tier).toBe(2);
  });

  it('does not re-report already reached tiers', () => {
    const fresh = evaluateMissionTiers(ctx({ score: 600 }), { score: 2 });
    expect(fresh.find(f => f.mission.key === 'score')).toBeUndefined();
  });

  it('reports a higher tier once surpassed', () => {
    const fresh = evaluateMissionTiers(ctx({ score: 3000 }), { score: 2 });
    expect(fresh.find(f => f.mission.key === 'score')?.tier).toBe(3);
  });

  it('handles lifetime metrics', () => {
    const fresh = evaluateMissionTiers(ctx({ totalRuns: 20 }), {});
    expect(fresh.find(f => f.mission.key === 'runs')?.tier).toBe(2);
  });
});

describe('nextObjective', () => {
  it('returns the closest next tier by relative progress', () => {
    const obj = nextObjective(ctx({ score: 400 }), { score: 1 });
    expect(obj?.label).toBe('Casse');
    expect(obj?.target).toBe(500);
    expect(obj?.current).toBe(400);
  });

  it('uses updated tiers after a fresh unlock', () => {
    const obj = nextObjective(ctx({ score: 600 }), { score: 2 });
    expect(obj?.target).toBe(3000);
  });

  it('returns null when every mission is maxed', () => {
    const all: Record<string, number> = {};
    for (const m of MISSIONS) all[m.key] = m.tiers.length;
    expect(nextObjective(ctx({ score: 999999 }), all)).toBeNull();
  });
});
