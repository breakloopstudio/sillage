// __tests__/services/voice-search.test.ts — Pipeline voix « identification »
// (interprétation structurée, décision d'auto-ouverture, fallbacks)

import { supabase } from '../../src/services/supabase';
import {
  interpretVoiceQuery,
  transcribeVoice,
  identifyFromVoice,
  pickAutoOpen,
  exactQueryMatch,
  mimeFromAudioUri,
  voiceNeedsSecondChance,
  pickBetterVoiceOutcome,
  VOICE_AUTO_OPEN_MIN_SCORE,
  VOICE_AUTO_OPEN_GAP,
  type VoiceInterpretation,
  type VoiceIdentifyOutcome,
} from '../../src/services/voice-search';
import { searchParfumsCached, searchParfumFromScan } from '../../src/services/impl/catalog.supabase';
import type { Parfum } from '../../src/models';

jest.mock('../../src/services/impl/catalog.supabase', () => ({
  searchParfumsCached: jest.fn(),
  searchParfumFromScan: jest.fn(),
}));

const mockInvoke = supabase.functions.invoke as jest.Mock;
const mockSearchCached = searchParfumsCached as jest.Mock;
const mockSearchFromScan = searchParfumFromScan as jest.Mock;

function makeParfum(id: string, marque: string, nom: string, extra?: Partial<Parfum>): Parfum {
  return { id, marque, nom, familleOlactive: 'woody', notesTete: [], notesCoeur: [], notesFond: [], ...extra } as Parfum;
}

function makeInterpretation(over: Partial<VoiceInterpretation>): VoiceInterpretation {
  return {
    isPerfumeRequest: true,
    marque: 'Dior',
    nom: 'Sauvage',
    typeParfum: null,
    alternatives: [],
    confidence: 'high',
    ...over,
  };
}

beforeEach(() => {
  mockInvoke.mockReset();
  mockSearchCached.mockReset();
  mockSearchFromScan.mockReset();
});

// ─── pickAutoOpen ───

describe('pickAutoOpen (décision d\'auto-ouverture)', () => {
  it('top score ≥ seuil + confiance haute + écart suffisant → auto-ouverture', () => {
    const top = { ...makeParfum('1', 'Dior', 'Sauvage'), _scanScore: 77 };
    const second = { ...makeParfum('2', 'Dior', 'Sauvage Eau de Toilette'), _scanScore: 38 };
    expect(pickAutoOpen([top, second], makeInterpretation({}))).toBe(top);
  });

  it('résultat unique au-dessus du seuil → auto-ouverture', () => {
    const top = { ...makeParfum('1', 'Dior', 'Sauvage'), _scanScore: VOICE_AUTO_OPEN_MIN_SCORE };
    expect(pickAutoOpen([top], makeInterpretation({}))).toBe(top);
  });

  it('confiance basse → jamais d\'auto-ouverture', () => {
    const top = { ...makeParfum('1', 'Dior', 'Sauvage'), _scanScore: 90 };
    expect(pickAutoOpen([top], makeInterpretation({ confidence: 'low' }))).toBeNull();
  });

  it('interprétation absente → jamais d\'auto-ouverture', () => {
    const top = { ...makeParfum('1', 'Dior', 'Sauvage'), _scanScore: 90 };
    expect(pickAutoOpen([top], null)).toBeNull();
  });

  it('score sous le seuil → pas d\'auto-ouverture', () => {
    const top = { ...makeParfum('1', 'Dior', 'Sauvage'), _scanScore: VOICE_AUTO_OPEN_MIN_SCORE - 1 };
    expect(pickAutoOpen([top], makeInterpretation({}))).toBeNull();
  });

  it('écart top/n°2 insuffisant → pas d\'auto-ouverture (ambiguïté)', () => {
    const top = { ...makeParfum('1', 'Dior', 'Sauvage'), _scanScore: 77 };
    const second = { ...makeParfum('2', 'Dior', 'Sauvage Elixir'), _scanScore: 77 - VOICE_AUTO_OPEN_GAP + 1 };
    expect(pickAutoOpen([top, second], makeInterpretation({}))).toBeNull();
  });

  it('résultats sans _scanScore (recherche brute) → pas d\'auto-ouverture', () => {
    const top = makeParfum('1', 'Dior', 'Sauvage');
    expect(pickAutoOpen([top], makeInterpretation({}))).toBeNull();
  });

  it('n°2 sans _scanScore → écart calculé contre 0', () => {
    const top = { ...makeParfum('1', 'Dior', 'Sauvage'), _scanScore: 77 };
    const second = makeParfum('2', 'Dior', 'Autre');
    expect(pickAutoOpen([top, second], makeInterpretation({}))).toBe(top);
  });

  it('liste vide → null', () => {
    expect(pickAutoOpen([], makeInterpretation({}))).toBeNull();
  });
});

// ─── exactQueryMatch (voie non connectée) ───

describe('exactQueryMatch', () => {
  const dior = makeParfum('1', 'Dior', 'Sauvage');
  const autre = makeParfum('2', 'Chanel', 'Allure');

  it('requête « marque + nom » exacte → top', () => {
    expect(exactQueryMatch([dior, autre], 'Dior Sauvage')).toBe(dior);
  });

  it('requête « nom » exacte → top', () => {
    expect(exactQueryMatch([dior, autre], 'sauvage')).toBe(dior);
  });

  it('insensible aux accents et à la casse', () => {
    const lancome = makeParfum('3', 'Lancôme', 'La Vie Est Belle');
    expect(exactQueryMatch([lancome], 'lancome la vie est belle')).toBe(lancome);
  });

  it('ambiguïté (n°2 matche aussi) → null', () => {
    const doublon = makeParfum('9', 'Autre Maison', 'Sauvage');
    expect(exactQueryMatch([dior, doublon], 'sauvage')).toBeNull();
  });

  it('pas de match exact → null', () => {
    expect(exactQueryMatch([dior], 'sauvage elixir')).toBeNull();
  });

  it('requête trop courte → null', () => {
    expect(exactQueryMatch([makeParfum('1', 'X', 'Y')], 'xy')).toBeNull();
  });
});

// ─── mimeFromAudioUri ───

describe('mimeFromAudioUri', () => {
  it('.wav → audio/wav', () => {
    expect(mimeFromAudioUri('file:///tmp/recording_123.wav')).toBe('audio/wav');
  });
  it('.m4a → audio/mp4', () => {
    expect(mimeFromAudioUri('file:///tmp/rec.m4a')).toBe('audio/mp4');
  });
  it('extension inconnue → audio/wav (défaut)', () => {
    expect(mimeFromAudioUri('file:///tmp/recording')).toBe('audio/wav');
  });
});

// ─── interpretVoiceQuery (normalisation client) ───

describe('interpretVoiceQuery', () => {
  it('normalise la réponse Edge Function', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        isPerfumeRequest: true,
        marque: ' Lancôme ',
        nom: ' La Vie Est Belle ',
        typeParfum: 'Eau de Parfum',
        alternatives: ['Alt 1', '', 42],
        confidence: 'high',
      },
      error: null,
    });
    const r = await interpretVoiceQuery('je cherche la vie est belle de lancôme');
    expect(r.marque).toBe('Lancôme');
    expect(r.nom).toBe('La Vie Est Belle');
    expect(r.typeParfum).toBe('Eau de Parfum');
    expect(r.alternatives).toEqual(['Alt 1']);
    expect(r.confidence).toBe('high');
    expect(mockInvoke).toHaveBeenCalledWith('interpret-voice-query', {
      body: { text: 'je cherche la vie est belle de lancôme', alternatives: [] },
    });
  });

  it('transmet les hypothèses alternatives (dédupliquées, bornées)', async () => {
    mockInvoke.mockResolvedValue({
      data: { isPerfumeRequest: true, marque: 'Dior', nom: 'Sauvage', typeParfum: null, alternatives: [], confidence: 'high' },
      error: null,
    });
    await interpretVoiceQuery('sauvage', ['Sauvage', 'sauvage elixir', '  Sauvage Elixir  ', 'omegas']);
    expect(mockInvoke).toHaveBeenCalledWith('interpret-voice-query', {
      body: { text: 'sauvage', alternatives: ['sauvage elixir', 'omegas'] },
    });
  });

  it('alternatives plafonnées à 4', async () => {
    mockInvoke.mockResolvedValue({
      data: { isPerfumeRequest: true, marque: 'Dior', nom: 'Sauvage', typeParfum: null, alternatives: [], confidence: 'high' },
      error: null,
    });
    await interpretVoiceQuery('sauvage', ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
    expect(mockInvoke).toHaveBeenCalledWith('interpret-voice-query', {
      body: { text: 'sauvage', alternatives: ['a1', 'a2', 'a3', 'a4'] },
    });
  });

  it('typeParfum hors enum → null', async () => {
    mockInvoke.mockResolvedValue({
      data: { isPerfumeRequest: true, marque: 'Dior', nom: 'X', typeParfum: 'Elixir Intense', alternatives: [], confidence: 'high' },
      error: null,
    });
    const r = await interpretVoiceQuery('x');
    expect(r.typeParfum).toBeNull();
  });

  it('data null → interprétation vide (fallback recherche)', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    const r = await interpretVoiceQuery('un truc');
    expect(r.isPerfumeRequest).toBe(false);
    expect(r.marque).toBeNull();
    expect(r.nom).toBeNull();
    expect(r.confidence).toBe('low');
  });

  it('erreur 401 → message connexion requise', async () => {
    const err = Object.assign(new Error('Unauthorized.'), { context: { status: 401 } });
    mockInvoke.mockRejectedValue(err);
    await expect(interpretVoiceQuery('x')).rejects.toThrow('Connexion requise');
  });

  it('erreur quota → message limite quotidienne', async () => {
    mockInvoke.mockRejectedValue(new Error('Limite quotidienne atteinte (voice).'));
    await expect(interpretVoiceQuery('x')).rejects.toThrow('Limite quotidienne vocale atteinte');
  });
});

// ─── transcribeVoice ───

describe('transcribeVoice', () => {
  it('retourne le texte transcrit', async () => {
    mockInvoke.mockResolvedValue({ data: { text: 'Sauvage de Dior' }, error: null });
    await expect(transcribeVoice('b64', 'audio/wav')).resolves.toBe('Sauvage de Dior');
  });

  it('erreur 429 → message quota', async () => {
    const err = Object.assign(new Error('Edge Function returned an error'), { context: { status: 429 } });
    mockInvoke.mockRejectedValue(err);
    await expect(transcribeVoice('b64', 'audio/wav')).rejects.toThrow('Limite quotidienne vocale atteinte');
  });

  it('lit le message d\'erreur du body JSON', async () => {
    const err = Object.assign(new Error('generic'), {
      context: { status: 429, json: async () => ({ error: 'Limite quotidienne atteinte (voice).' }) },
    });
    mockInvoke.mockRejectedValue(err);
    await expect(transcribeVoice('b64', 'audio/wav')).rejects.toThrow('Limite quotidienne vocale atteinte');
  });
});

// ─── identifyFromVoice (pipeline) ───

describe('identifyFromVoice', () => {
  it('connecté + interprétation nommée → searchParfumFromScan + auto-ouverture', async () => {
    mockInvoke.mockResolvedValue({
      data: { isPerfumeRequest: true, marque: 'Dior', nom: 'Sauvage', typeParfum: 'Eau de Parfum', alternatives: [], confidence: 'high' },
      error: null,
    });
    const top = { ...makeParfum('1', 'Dior', 'Sauvage'), _scanScore: 77 };
    const second = { ...makeParfum('2', 'Dior', 'Sauvage Eau de Toilette'), _scanScore: 38 };
    mockSearchFromScan.mockResolvedValue([top, second]);

    const outcome = await identifyFromVoice('sauvage en eau de parfum', { isAuthenticated: true });
    expect(mockSearchFromScan).toHaveBeenCalledWith({
      marque: 'Dior',
      nom: 'Sauvage',
      typeParfum: 'Eau de Parfum',
      alternatives: [],
    });
    expect(mockSearchCached).not.toHaveBeenCalled();
    expect(outcome.interpreted).toBe(true);
    expect(outcome.results).toEqual([top, second]);
    expect(outcome.autoOpen).toBe(top);
    expect(outcome.query).toBe('sauvage en eau de parfum');
  });

  it('interprétation requête vague → recherche texte brute', async () => {
    mockInvoke.mockResolvedValue({
      data: { isPerfumeRequest: false, marque: null, nom: null, typeParfum: null, alternatives: [], confidence: 'low' },
      error: null,
    });
    const rows = [makeParfum('1', 'A', 'Fresh')];
    mockSearchCached.mockResolvedValue(rows);

    const outcome = await identifyFromVoice('un parfum frais pour l été', { isAuthenticated: true });
    expect(mockSearchFromScan).not.toHaveBeenCalled();
    expect(mockSearchCached).toHaveBeenCalledWith('un parfum frais pour l été');
    expect(outcome.interpreted).toBe(false);
    expect(outcome.results).toEqual(rows);
  });

  it('interprétation en échec → dégradation en recherche brute', async () => {
    mockInvoke.mockRejectedValue(new Error('Échec de l\'interprétation vocale.'));
    const rows = [makeParfum('1', 'Dior', 'Sauvage')];
    mockSearchCached.mockResolvedValue(rows);

    const outcome = await identifyFromVoice('dior sauvage', { isAuthenticated: true });
    expect(mockSearchFromScan).not.toHaveBeenCalled();
    expect(outcome.interpreted).toBe(false);
    expect(outcome.results).toEqual(rows);
    // Match exact « marque + nom » → auto-ouverture même sans LLM.
    expect(outcome.autoOpen?.id).toBe('1');
  });

  it('non connecté → pas d\'interprétation, recherche brute directe', async () => {
    const rows = [makeParfum('1', 'Dior', 'Sauvage')];
    mockSearchCached.mockResolvedValue(rows);

    const outcome = await identifyFromVoice('dior sauvage', { isAuthenticated: false });
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockSearchFromScan).not.toHaveBeenCalled();
    expect(outcome.interpreted).toBe(false);
    expect(outcome.autoOpen?.id).toBe('1');
  });

  it('searchParfumFromScan vide → repli recherche brute', async () => {
    mockInvoke.mockResolvedValue({
      data: { isPerfumeRequest: true, marque: 'Maison Inconnue', nom: 'Introuvable', typeParfum: null, alternatives: [], confidence: 'high' },
      error: null,
    });
    mockSearchFromScan.mockResolvedValue([]);
    const rows = [makeParfum('5', 'X', 'Y')];
    mockSearchCached.mockResolvedValue(rows);

    const outcome = await identifyFromVoice('maison inconnue introuvable', { isAuthenticated: true });
    expect(mockSearchCached).toHaveBeenCalled();
    expect(outcome.results).toEqual(rows);
    expect(outcome.autoOpen).toBeNull();
  });

  it('searchParfumFromScan rejette → repli recherche brute', async () => {
    mockInvoke.mockResolvedValue({
      data: { isPerfumeRequest: true, marque: 'Dior', nom: 'Sauvage', typeParfum: null, alternatives: [], confidence: 'high' },
      error: null,
    });
    mockSearchFromScan.mockRejectedValue(new Error('RPC down'));
    const rows = [makeParfum('1', 'Dior', 'Sauvage')];
    mockSearchCached.mockResolvedValue(rows);

    const outcome = await identifyFromVoice('dior sauvage', { isAuthenticated: true });
    expect(mockSearchCached).toHaveBeenCalledWith('dior sauvage');
    expect(outcome.interpreted).toBe(false);
    expect(outcome.results).toEqual(rows);
  });

  it('interprétation marque seule → branche marque du moteur scan', async () => {
    mockInvoke.mockResolvedValue({
      data: { isPerfumeRequest: true, marque: 'Mugler', nom: null, typeParfum: null, alternatives: [], confidence: 'high' },
      error: null,
    });
    const rows = [{ ...makeParfum('1', 'Mugler', 'Alien'), _scanScore: 15 }];
    mockSearchFromScan.mockResolvedValue(rows);

    const outcome = await identifyFromVoice('du mugler', { isAuthenticated: true });
    expect(mockSearchFromScan).toHaveBeenCalledWith({
      marque: 'Mugler',
      nom: null,
      typeParfum: null,
      alternatives: [],
    });
    // Score marque seule (15) < seuil → pas d'auto-ouverture.
    expect(outcome.autoOpen).toBeNull();
    expect(outcome.results).toEqual(rows);
    // Requête spécifique + confiance haute + résultats → pas de seconde chance.
    expect(outcome.confidence).toBe('high');
    expect(outcome.specific).toBe(true);
    expect(voiceNeedsSecondChance(outcome)).toBe(false);
  });

  it('transmet les alternatives STT à l\'interprétation', async () => {
    mockInvoke.mockResolvedValue({
      data: { isPerfumeRequest: true, marque: 'Dior', nom: 'Sauvage', typeParfum: null, alternatives: [], confidence: 'high' },
      error: null,
    });
    mockSearchFromScan.mockResolvedValue([{ ...makeParfum('1', 'Dior', 'Sauvage'), _scanScore: 65 }]);

    await identifyFromVoice('sauvage', { isAuthenticated: true, alternatives: ['sauvage elixir'] });
    expect(mockInvoke).toHaveBeenCalledWith('interpret-voice-query', {
      body: { text: 'sauvage', alternatives: ['sauvage elixir'] },
    });
  });
});

// ─── voiceNeedsSecondChance (gate qualité) ───

function makeOutcome(over: Partial<VoiceIdentifyOutcome>): VoiceIdentifyOutcome {
  return {
    results: [],
    query: 'q',
    autoOpen: null,
    interpreted: false,
    confidence: null,
    specific: null,
    topScore: null,
    ...over,
  };
}

describe('voiceNeedsSecondChance (gate qualité)', () => {
  it('auto-ouverture → jamais de seconde chance', () => {
    const o = makeOutcome({ autoOpen: makeParfum('1', 'Dior', 'Sauvage'), results: [makeParfum('1', 'Dior', 'Sauvage')] });
    expect(voiceNeedsSecondChance(o)).toBe(false);
  });

  it('0 résultat → seconde chance', () => {
    expect(voiceNeedsSecondChance(makeOutcome({ results: [] }))).toBe(true);
  });

  it('résultats + interprétation absente (non connecté) → seconde chance', () => {
    const o = makeOutcome({ results: [makeParfum('1', 'X', 'Y')], confidence: null });
    expect(voiceNeedsSecondChance(o)).toBe(true);
  });

  it('résultats + confiance basse → seconde chance (transcript probablement écorché)', () => {
    const o = makeOutcome({ results: [makeParfum('1', 'X', 'Y')], confidence: 'low', specific: true });
    expect(voiceNeedsSecondChance(o)).toBe(true);
  });

  it('résultats + confiance haute → pas de seconde chance', () => {
    const o = makeOutcome({ results: [makeParfum('1', 'X', 'Y')], confidence: 'high', specific: true });
    expect(voiceNeedsSecondChance(o)).toBe(false);
  });

  it('requête explicitement vague avec résultats → pas de seconde chance', () => {
    const o = makeOutcome({ results: [makeParfum('1', 'X', 'Y')], confidence: 'low', specific: false });
    expect(voiceNeedsSecondChance(o)).toBe(false);
  });

  it('0 résultat prime sur specific=false (seconde chance quand même)', () => {
    const o = makeOutcome({ results: [], confidence: 'low', specific: false });
    expect(voiceNeedsSecondChance(o)).toBe(true);
  });
});

// ─── pickBetterVoiceOutcome ───

describe('pickBetterVoiceOutcome', () => {
  const p1 = makeParfum('1', 'Dior', 'Sauvage');
  const p2 = makeParfum('2', 'Chanel', 'Allure');

  it('retry avec auto-ouverture l\'emporte', () => {
    const first = makeOutcome({ results: [p2] });
    const retry = makeOutcome({ results: [p1], autoOpen: p1 });
    expect(pickBetterVoiceOutcome(first, retry)).toBe(retry);
  });

  it('auto-ouverture du premier passage préservée', () => {
    const first = makeOutcome({ results: [p1], autoOpen: p1 });
    const retry = makeOutcome({ results: [p2] });
    expect(pickBetterVoiceOutcome(first, retry)).toBe(first);
  });

  it('auto-ouverture des deux côtés → retry (transcription serveur plus fraîche)', () => {
    const first = makeOutcome({ results: [p1], autoOpen: p1 });
    const retry = makeOutcome({ results: [p2], autoOpen: p2 });
    expect(pickBetterVoiceOutcome(first, retry)).toBe(retry);
  });

  it('résultats confiants l\'emportent sur résultats sans confiance', () => {
    const first = makeOutcome({ results: [p2], confidence: null });
    const retry = makeOutcome({ results: [p1], confidence: 'high' });
    expect(pickBetterVoiceOutcome(first, retry)).toBe(retry);
  });

  it('à confiance égale, le plus de résultats l\'emporte', () => {
    const first = makeOutcome({ results: [p1, p2], confidence: 'high' });
    const retry = makeOutcome({ results: [p2], confidence: 'high' });
    expect(pickBetterVoiceOutcome(first, retry)).toBe(first);
  });
});
