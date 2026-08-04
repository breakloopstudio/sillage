// __tests__/services/catalog-bridge.test.ts — Ponts mémoire voix (auto-ouverture)

import {
  setPendingVoiceAutoOpen,
  consumePendingVoiceAutoOpen,
  setPendingVoiceResults,
  consumePendingVoiceResults,
} from '../../src/services/catalog-bridge';
import type { Parfum } from '../../src/models';

function makeParfum(id: string): Parfum {
  return { id, marque: 'Dior', nom: 'Sauvage', familleOlactive: 'woody', notesTete: [], notesCoeur: [], notesFond: [] } as Parfum;
}

describe('pont voix : auto-ouverture', () => {
  it('payload consommé uniquement si l\'id correspond', () => {
    setPendingVoiceAutoOpen({ parfumId: '1', query: 'sauvage', results: [makeParfum('1')] });
    expect(consumePendingVoiceAutoOpen('2')).toBeNull();
    // Le payload a été consommé (même raté) — pas de résidu.
    expect(consumePendingVoiceAutoOpen('1')).toBeNull();
  });

  it('payload valide livré une seule fois', () => {
    setPendingVoiceAutoOpen({ parfumId: '1', query: 'sauvage', results: [makeParfum('1')] });
    const p = consumePendingVoiceAutoOpen('1');
    expect(p?.parfumId).toBe('1');
    expect(p?.query).toBe('sauvage');
    expect(p?.results).toHaveLength(1);
    expect(consumePendingVoiceAutoOpen('1')).toBeNull();
  });

  it('payload expiré (> 2 min) → null', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValueOnce(now + 121_000);
    setPendingVoiceAutoOpen({ parfumId: '1', query: 'x', results: [] });
    expect(consumePendingVoiceAutoOpen('1')).toBeNull();
    jest.restoreAllMocks();
  });
});

describe('pont voix : résultats restaurés (bannière)', () => {
  it('résultats livrés une seule fois', () => {
    setPendingVoiceResults('sauvage', [makeParfum('1'), makeParfum('2')]);
    const p = consumePendingVoiceResults();
    expect(p?.query).toBe('sauvage');
    expect(p?.results).toHaveLength(2);
    expect(consumePendingVoiceResults()).toBeNull();
  });

  it('résultats expirés (> 2 min) → null', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValueOnce(now).mockReturnValueOnce(now + 121_000);
    setPendingVoiceResults('x', [makeParfum('1')]);
    expect(consumePendingVoiceResults()).toBeNull();
    jest.restoreAllMocks();
  });
});
