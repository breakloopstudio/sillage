// __tests__/services/catalog-search.test.ts
// Tests searchParfumsCached + searchParfumFromScan (RPC Supabase)

import { supabase } from '../../src/services/supabase';
import { searchParfumsCached, searchParfumFromScan, SearchError, clearSearchCache } from '../../src/services/catalog';

const mockRpc = supabase.rpc as jest.Mock;

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    nom: overrides.nom ?? 'Parfum Test',
    marque: overrides.marque ?? 'Marque Test',
    review_count: overrides.review_count ?? 100,
    rating_count: overrides.rating_count ?? 200,
    popularity_score: overrides.popularity_score ?? 150,
    search_text: overrides.search_text ?? `${(overrides.marque ?? 'marque test').toLowerCase()} ${(overrides.nom ?? 'parfum test').toLowerCase()}`,
    best_price: overrides.best_price ?? null,
    ...overrides,
  };
}

beforeEach(() => {
  mockRpc.mockReset();
  clearSearchCache();
});

describe('searchParfumsCached', () => {
  it('returns [] for queries < 2 chars', async () => {
    expect(await searchParfumsCached('a')).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls RPC search_parfums with correct args', async () => {
    mockRpc.mockResolvedValue({ data: [row('p1', { nom: 'Chance', marque: 'Chanel' })], error: null });
    const results = await searchParfumsCached('chanel');
    expect(mockRpc).toHaveBeenCalledWith('search_parfums', { q: 'chanel', max_results: 50 });
    expect(results).toHaveLength(1);
    expect(results[0].nom).toBe('Chance');
    expect(results[0].marque).toBe('Chanel');
  });

  it('throws SearchError on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Network error' } });
    await expect(searchParfumsCached('chanel')).rejects.toThrow(SearchError);
  });

  it('deduplicates by marque+nom', async () => {
    mockRpc.mockResolvedValue({
      data: [
        row('p1', { nom: 'Sauvage', marque: 'Dior', popularity_score: 200 }),
        row('p2', { nom: 'Sauvage', marque: 'Dior', popularity_score: 100 }),
      ],
      error: null,
    });
    const results = await searchParfumsCached('dior sauvage');
    expect(results).toHaveLength(1);
  });

  it('caches results (second call does not hit RPC)', async () => {
    mockRpc.mockResolvedValue({ data: [row('p1')], error: null });
    await searchParfumsCached('test');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    await searchParfumsCached('test');
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('clearSearchCache forces new RPC call', async () => {
    mockRpc.mockResolvedValue({ data: [row('p1')], error: null });
    await searchParfumsCached('test');
    clearSearchCache();
    await searchParfumsCached('test');
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('maps snake_case rows to camelCase Parfum', async () => {
    mockRpc.mockResolvedValue({
      data: [row('p1', {
        nom: 'N°5', marque: 'Chanel', best_price: 89.99,
        notes_tete: ['Aldehydes'], notes_coeur: ['Jasmine'], notes_fond: ['Sandalwood'],
        image_url: 'https://img.webp', famille_olfactive: 'Floral',
      })],
      error: null,
    });
    const [p] = await searchParfumsCached('chanel');
    expect(p.bestPrice).toBe(89.99);
    expect(p.notesTete).toEqual(['Aldehydes']);
    expect(p.imageUrl).toBe('https://img.webp');
    expect(p.familleOlactive).toBe('Floral');
  });
});

describe('searchParfumFromScan', () => {
  it('returns [] if both marque and nom are null', async () => {
    expect(await searchParfumFromScan({ marque: null, nom: null })).toEqual([]);
  });

  it('boosts exact nom match (+50) above partial', async () => {
    mockRpc.mockResolvedValue({
      data: [
        row('p1', { nom: 'Sauvage Parfum', marque: 'Dior', search_text: 'dior sauvage parfum' }),
        row('p2', { nom: 'Sauvage', marque: 'Dior', search_text: 'dior sauvage' }),
      ],
      error: null,
    });
    const results = await searchParfumFromScan({ marque: 'Dior', nom: 'Sauvage' });
    expect(results[0].id).toBe('p2');
  });

  it('boosts exact marque match (+15)', async () => {
    mockRpc.mockResolvedValue({
      data: [
        row('p1', { nom: 'Test', marque: 'Diorissimo', search_text: 'diorissimo test' }),
        row('p2', { nom: 'Test', marque: 'Dior', search_text: 'dior test' }),
      ],
      error: null,
    });
    const results = await searchParfumFromScan({ marque: 'Dior', nom: 'Test' });
    expect(results[0].id).toBe('p2');
  });

  it('une hypothèse alternative compte comme un nom exact (+50)', async () => {
    mockRpc.mockResolvedValue({
      data: [row('p1', { nom: 'Sauvage', marque: 'Dior', search_text: 'dior sauvage' })],
      error: null,
    });
    // nom principal mal lu ("Savag") → partiel seul ; l'alternative "Sauvage" donne le match exact
    const results = await searchParfumFromScan({ marque: 'Dior', nom: 'Savag', alternatives: ['Sauvage'] });
    expect(results[0].id).toBe('p1');
    expect((results[0] as { _scanScore?: number })._scanScore).toBe(65); // 50 nom + 15 marque
  });

  it('le typeParfum lu départage les flankers (EDP > EDT)', async () => {
    mockRpc.mockResolvedValue({
      data: [
        row('p1', { nom: 'Sauvage Eau de Toilette', marque: 'Dior', type_parfum: 'Eau de Toilette', search_text: 'dior sauvage eau de toilette' }),
        row('p2', { nom: 'Sauvage Eau de Parfum', marque: 'Dior', type_parfum: 'Eau de Parfum', search_text: 'dior sauvage eau de parfum' }),
      ],
      error: null,
    });
    const results = await searchParfumFromScan({ marque: 'Dior', nom: 'Sauvage', typeParfum: 'Eau de Parfum' });
    expect(results[0].id).toBe('p2');
  });

  it('concentration prononcée : le flanker concentré bat le nom de base sans type (L\'Homme Idéal Parfum > EDT)', async () => {
    // La fiche de base « L'Homme Idéal » EST l'EDT (type_parfum NULL) : quand
    // l'utilisateur dit « parfum », son match exact sur le nom seul ne doit pas
    // écraser le flanker « L'Homme Idéal Parfum » (rétrogradation +50 → +25,
    // candidat « nom + concentration » ajouté).
    mockRpc.mockResolvedValue({
      data: [
        row('p1', { nom: "L'Homme Idéal", marque: 'Guerlain', type_parfum: null, popularity_score: 900, search_text: 'guerlain l homme ideal' }),
        row('p2', { nom: "L'Homme Idéal Parfum", marque: 'Guerlain', type_parfum: 'Parfum', popularity_score: 100, search_text: 'guerlain l homme ideal parfum' }),
        row('p3', { nom: "L'Homme Idéal Eau de Parfum", marque: 'Guerlain', type_parfum: 'Eau de Parfum', popularity_score: 800, search_text: 'guerlain l homme ideal eau de parfum' }),
      ],
      error: null,
    });
    const results = await searchParfumFromScan({ marque: 'Guerlain', nom: "L'Homme Idéal", typeParfum: 'Parfum' });
    expect(results[0].id).toBe('p2');
    expect((results[0] as { _scanScore?: number })._scanScore).toBe(77); // 50 nom+type exact + 15 marque + 12 type
    expect((results[1] as { _scanScore?: number })._scanScore).toBe(40); // base : 25 rétrogradé + 15 marque
  });

  it('sans concentration prononcée, le nom de base garde son match exact', async () => {
    mockRpc.mockResolvedValue({
      data: [
        row('p1', { nom: "L'Homme Idéal", marque: 'Guerlain', type_parfum: null, search_text: 'guerlain l homme ideal' }),
        row('p2', { nom: "L'Homme Idéal Parfum", marque: 'Guerlain', type_parfum: 'Parfum', search_text: 'guerlain l homme ideal parfum' }),
      ],
      error: null,
    });
    const results = await searchParfumFromScan({ marque: 'Guerlain', nom: "L'Homme Idéal" });
    expect(results[0].id).toBe('p1');
    expect((results[0] as { _scanScore?: number })._scanScore).toBe(65); // 50 nom + 15 marque, pas de rétrogradation
  });

  it('« cologne » dans le nom confirme la concentration Eau de Cologne (type_parfum NULL)', async () => {
    // readType est canonicalisé en 'eau_de_cologne' par typeParfumLabel ; une
    // fiche nommée « … Cologne » avec type_parfum NULL doit confirmer (pas de
    // rétrogradation injustifiée du match exact).
    mockRpc.mockResolvedValue({
      data: [
        row('p1', { nom: 'Mugler Cologne', marque: 'Mugler', type_parfum: null, search_text: 'mugler cologne' }),
      ],
      error: null,
    });
    const results = await searchParfumFromScan({ marque: 'Mugler', nom: 'Mugler Cologne', typeParfum: 'Eau de Cologne' });
    expect((results[0] as { _scanScore?: number })._scanScore).toBe(77); // 50 nom + 15 marque + 12 type
  });

  it('Extrait prononcé : le candidat « nom Extrait de Parfum » matche le flanker en exact', async () => {
    // Le catalogue nomme les extraits « X Extrait de Parfum » (pas « X Extrait ») :
    // un candidat dédié redonne l'auto-ouverture au lieu d'une simple inclusion.
    mockRpc.mockResolvedValue({
      data: [
        row('p1', { nom: 'Baccarat Rouge 540', marque: 'Maison Francis Kurkdjian', type_parfum: null, search_text: 'maison francis kurkdjian baccarat rouge 540' }),
        row('p2', { nom: 'Baccarat Rouge 540 Extrait de Parfum', marque: 'Maison Francis Kurkdjian', type_parfum: 'Extrait', search_text: 'maison francis kurkdjian baccarat rouge 540 extrait de parfum' }),
      ],
      error: null,
    });
    const results = await searchParfumFromScan({ marque: 'Maison Francis Kurkdjian', nom: 'Baccarat Rouge 540', typeParfum: 'Extrait' });
    expect(results[0].id).toBe('p2');
    expect((results[0] as { _scanScore?: number })._scanScore).toBe(77); // 50 nom exact + 15 marque + 12 type
  });

  // ── v3 : fuzzy, alias, marque seule, tri ─────────────────────────────────

  it('typo de lecture → bonus fuzzy (au lieu de 0)', async () => {
    mockRpc.mockResolvedValue({
      data: [row('p1', { nom: 'Sauvage', marque: 'Dior', search_text: 'dior sauvage' })],
      error: null,
    });
    // « Savag » : ni exact ni substring → fuzzy Levenshtein (distance 1)
    const results = await searchParfumFromScan({ marque: 'Dior', nom: 'Savag' });
    const score = (results[0] as { _scanScore?: number })._scanScore ?? 0;
    expect(score).toBeGreaterThan(15); // fuzzy > 0 (+ 15 marque)
    expect(score).toBeLessThan(65); // moins qu'un match exact
  });

  it('alias marque : YSL matche Yves Saint Laurent en exact (+15)', async () => {
    mockRpc.mockResolvedValue({
      data: [row('p1', { nom: 'Black Opium', marque: 'Yves Saint Laurent', search_text: 'yves saint laurent black opium' })],
      error: null,
    });
    const results = await searchParfumFromScan({ marque: 'YSL', nom: 'Black Opium' });
    expect((results[0] as { _scanScore?: number })._scanScore).toBe(65); // 50 nom + 15 marque alias
  });

  it('typeParfum non canonique ("EDP") ne pénalise plus le bon candidat', async () => {
    mockRpc.mockResolvedValue({
      data: [row('p1', { nom: 'Sauvage', marque: 'Dior', type_parfum: 'Eau de Parfum', search_text: 'dior sauvage' })],
      error: null,
    });
    const results = await searchParfumFromScan({ marque: 'Dior', nom: 'Sauvage', typeParfum: 'EDP' });
    expect((results[0] as { _scanScore?: number })._scanScore).toBe(77); // 50 nom + 15 marque + 12 type
  });

  it('à score égal, la popularité départage (pas le prix)', async () => {
    // Deux candidats au même _scanScore (inclusion « test » +25 chacun) :
    // la popularité (900 > 100) l'emporte sur le prix (50 < 200).
    mockRpc.mockResolvedValue({
      data: [
        row('p1', { nom: 'Test A', marque: 'Maison X', popularity_score: 100, best_price: 50, search_text: 'maison x test a' }),
        row('p2', { nom: 'Test B', marque: 'Maison Y', popularity_score: 900, best_price: 200, search_text: 'maison y test b' }),
      ],
      error: null,
    });
    const results = await searchParfumFromScan({ marque: null, nom: 'Test' });
    expect(results[0].id).toBe('p2');
  });

  it('marque seule → catalogue de la maison (getParfumsByMarque), sans RPC trgm', async () => {
    const builder = (supabase.from as jest.Mock)('parfums');
    const originalThen = builder.then;
    builder.then = (resolve: (v: unknown) => void) => resolve({
      data: [
        row('p1', { nom: 'Sauvage', marque: 'Dior', popularity_score: 500 }),
        row('p2', { nom: 'Miss Dior', marque: 'Dior', popularity_score: 300 }),
      ],
      error: null,
    });
    try {
      const results = await searchParfumFromScan({ marque: 'Dior', nom: null });
      expect(mockRpc).not.toHaveBeenCalled();
      expect(results.map((p) => p.id)).toEqual(['p1', 'p2']); // popularité desc
    } finally {
      builder.then = originalThen;
    }
  });

  it('marque seule en alias (YSL) → requête .in avec les formes de surface connues', async () => {
    const builder = (supabase.from as jest.Mock)('parfums');
    const originalThen = builder.then;
    (builder.in as jest.Mock).mockClear();
    builder.then = (resolve: (v: unknown) => void) => resolve({
      data: [row('p1', { nom: 'Black Opium', marque: 'Yves Saint Laurent', popularity_score: 800 })],
      error: null,
    });
    try {
      const results = await searchParfumFromScan({ marque: 'YSL', nom: null });
      // La forme longue catalogue est bien interrogée (pas seulement « YSL »).
      expect(builder.in).toHaveBeenCalledWith('marque', expect.arrayContaining(['Yves Saint Laurent']));
      expect(mockRpc).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect((results[0] as { _scanScore?: number })._scanScore).toBe(15); // alias → marque exacte
    } finally {
      builder.then = originalThen;
    }
  });

  it('marque seule non trouvée en exact → fallback trgm sur la forme longue', async () => {
    // Le builder par défaut résout data: [] → .in vide → fallback trgm.
    mockRpc.mockResolvedValue({
      data: [row('p1', { nom: 'Black Opium', marque: 'Yves Saint Laurent', search_text: 'yves saint laurent black opium' })],
      error: null,
    });
    const results = await searchParfumFromScan({ marque: 'YSL', nom: null });
    // Fallback sur la forme la plus longue (meilleur rappel trgm que « ysl »).
    expect(mockRpc).toHaveBeenCalledWith('search_parfums', { q: 'yves saint laurent', max_results: 50 });
    expect(results).toHaveLength(1);
    expect((results[0] as { _scanScore?: number })._scanScore).toBe(15); // alias → marque exacte
  });

  it('requête principale en échec → propage l\'erreur', async () => {
    mockRpc.mockRejectedValue({ message: 'RPC down' });
    await expect(searchParfumFromScan({ marque: 'Dior', nom: 'Sauvage' })).rejects.toThrow(SearchError);
  });

  it('alternative en échec → best-effort, la requête principale suffit', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: [row('p1', { nom: 'Sauvage', marque: 'Dior', search_text: 'dior sauvage' })], error: null })
      .mockRejectedValueOnce({ message: 'RPC down' });
    const results = await searchParfumFromScan({ marque: 'Dior', nom: 'Sauvage', alternatives: ['Sauvaje'] });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('p1');
  });
});
