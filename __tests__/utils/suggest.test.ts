import { buildSuggestionIndex, matchSuggestions, type SuggestionRow } from '../../src/utils/suggest';

const ROWS: SuggestionRow[] = [
  { id: 'p1', nom: 'Sauvage', marque: 'Dior', pop: 9000 },
  { id: 'p2', nom: "J'adore", marque: 'Dior', pop: 8000 },
  { id: 'p3', nom: 'Bleu de Chanel', marque: 'Chanel', pop: 8500 },
  { id: 'p4', nom: "Terre d'Hermès", marque: 'Hermès', pop: 7000 },
  { id: 'p5', nom: 'Black Opium', marque: 'Yves Saint Laurent', pop: 6000 },
  { id: 'p6', nom: 'La Vie Est Belle', marque: 'Lancôme', pop: 5500 },
];

describe('buildSuggestionIndex', () => {
  it('déduplique les marques en gardant la première (pop max)', () => {
    const idx = buildSuggestionIndex(ROWS);
    expect(idx.brands).toHaveLength(5);
    const dior = idx.brands.find(b => b.label === 'Dior');
    expect(dior?.pop).toBe(9000);
  });

  it('construit une entrée nom par parfum (label, sub, key normalisée)', () => {
    const idx = buildSuggestionIndex(ROWS);
    expect(idx.names).toHaveLength(6);
    const sauvage = idx.names.find(n => n.id === 'p1');
    expect(sauvage).toMatchObject({ kind: 'parfum', label: 'Sauvage', sub: 'Dior', key: 'sauvage' });
  });

  it('ignore les lignes sans nom ni marque', () => {
    const idx = buildSuggestionIndex([{ id: 'x', nom: '', marque: '', pop: 0 }]);
    expect(idx.brands).toHaveLength(0);
    expect(idx.names).toHaveLength(0);
  });
});

describe('matchSuggestions', () => {
  const idx = buildSuggestionIndex(ROWS);

  it('retourne [] pour une query vide ou blanche', () => {
    expect(matchSuggestions(idx, '')).toEqual([]);
    expect(matchSuggestions(idx, '   ')).toEqual([]);
  });

  it('matche par préfixe dès 1 caractère', () => {
    const res = matchSuggestions(idx, 's');
    expect(res[0].label).toBe('Sauvage');
  });

  it('insensible aux accents', () => {
    const res = matchSuggestions(idx, 'hermes');
    expect(res.some(r => r.label === 'Hermès')).toBe(true);
  });

  it('marques avant noms', () => {
    const res = matchSuggestions(idx, 'chanel');
    expect(res[0]).toMatchObject({ kind: 'brand', label: 'Chanel' });
    expect(res.some(r => r.kind === 'parfum' && r.label === 'Bleu de Chanel')).toBe(true);
  });

  it('préfixe de mot sur les noms multiples', () => {
    const res = matchSuggestions(idx, 'vie');
    expect(res.some(r => r.label === 'La Vie Est Belle')).toBe(true);
  });

  it('respecte la limite et déduplique', () => {
    const res = matchSuggestions(idx, 'd', 3);
    expect(res).toHaveLength(3);
    const keys = res.map(r => `${r.kind}_${r.key}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('score exact devant préfixe', () => {
    const res = matchSuggestions(idx, 'sauvage');
    expect(res[0]).toMatchObject({ kind: 'parfum', label: 'Sauvage' });
  });

  it('déduplique les noms identiques (garde le plus populaire)', () => {
    const local = buildSuggestionIndex([
      { id: 'a', nom: 'Sauvage', marque: 'Dior', pop: 9000 },
      { id: 'b', nom: 'Sauvage', marque: 'Zara', pop: 100 },
    ]);
    const dupes = matchSuggestions(local, 'sauvage').filter(r => r.kind === 'parfum');
    expect(dupes).toHaveLength(1);
    expect(dupes[0].id).toBe('a');
  });

  it('ne matche rien pour une query absente du catalogue', () => {
    expect(matchSuggestions(idx, 'zzz')).toEqual([]);
  });
});
