// __tests__/services/openai-vision.test.ts — Normalisation client du ScanResult (v4)

import { supabase } from '../../src/services/supabase';
import { analyzeImage } from '../../src/services/openai-vision';

const mockInvoke = supabase.functions.invoke as jest.Mock;

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('normalisation openai-vision (v4)', () => {
  it('réponse v3 sans textRead → indéterminé (rétrocompat), visualMatch false', async () => {
    mockInvoke.mockResolvedValue({ data: { marque: 'Dior', nom: 'Sauvage', confidence: 'high' }, error: null });
    const r = await analyzeImage('img');
    expect(r.textRead).toBeUndefined(); // pas false : l'UI retombe sur le comportement v3
    expect(r.visualMatch).toBe(false);
    expect(r.isPerfume).toBe(true);
  });

  it('textRead=false explicite conservé', async () => {
    mockInvoke.mockResolvedValue({ data: { marque: 'JPG', nom: 'Le Male', confidence: 'low', textRead: false }, error: null });
    const r = await analyzeImage('img');
    expect(r.textRead).toBe(false);
  });

  it('conserve textRead=false + visualMatch=true (re-ranking)', async () => {
    mockInvoke.mockResolvedValue({
      data: { marque: 'Jean Paul Gaultier', nom: 'Le Beau Le Parfum', confidence: 'high', textRead: false, visualMatch: true },
      error: null,
    });
    const r = await analyzeImage('img');
    expect(r.textRead).toBe(false);
    expect(r.visualMatch).toBe(true);
    expect(r.confidence).toBe('high');
  });

  it('failureReason invalide → none', async () => {
    mockInvoke.mockResolvedValue({ data: { marque: 'Dior', nom: 'X', failureReason: 'injected' }, error: null });
    const r = await analyzeImage('img');
    expect(r.failureReason).toBe('none');
  });

  it('failureReason valide conservé', async () => {
    mockInvoke.mockResolvedValue({ data: { marque: null, nom: null, failureReason: 'blur' }, error: null });
    const r = await analyzeImage('img');
    expect(r.failureReason).toBe('blur');
  });

  it('volumeMl non numérique → null', async () => {
    mockInvoke.mockResolvedValue({ data: { marque: 'Dior', nom: 'X', volumeMl: '100' }, error: null });
    const r = await analyzeImage('img');
    expect(r.volumeMl).toBe(null);
  });

  it('data null → résultat vide isPerfume=false (routé clarify)', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    const r = await analyzeImage('img');
    expect(r.isPerfume).toBe(false);
    expect(r.marque).toBe(null);
    expect(r.confidence).toBe('low');
  });
});
