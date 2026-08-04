// __tests__/utils/scan-display.test.ts — Chips de confiance + ligne Lu/Hypothèse (v4)

import { scanChip, scanReadLine } from '../../src/utils/scan-display';
import type { Parfum, ScanResult } from '../../src/models';

function makeTop(overrides: Partial<Parfum> = {}): Parfum {
  return {
    id: 'p1',
    marque: 'Jean Paul Gaultier',
    nom: 'Le Male',
    familleOlactive: 'aromatique',
    notesTete: [],
    notesCoeur: [],
    notesFond: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRead(overrides: Partial<ScanResult> = {}): ScanResult {
  return { marque: 'Jean Paul Gaultier', nom: 'Le Male', volumeMl: null, typeParfum: null, ...overrides };
}

describe('scanChip', () => {
  it('texte lu + high → Correspondance (deal)', () => {
    expect(scanChip('high', makeRead({ textRead: true })))
      .toEqual({ label: 'Correspondance', icon: 'checkmark-circle', tone: 'deal' });
  });

  it('texte lu + low → Correspondance probable (fair)', () => {
    expect(scanChip('low', makeRead({ textRead: true })))
      .toEqual({ label: 'Correspondance probable', icon: 'help-circle-outline', tone: 'fair' });
  });

  it('forme sans vérification → Reconnu à la forme (fair)', () => {
    expect(scanChip('low', makeRead({ textRead: false })))
      .toEqual({ label: 'Reconnu à la forme', icon: 'eye-outline', tone: 'fair' });
  });

  it('forme + re-ranking high → Vérifié visuellement (deal)', () => {
    expect(scanChip('high', makeRead({ textRead: false, visualMatch: true })))
      .toEqual({ label: 'Vérifié visuellement', icon: 'checkmark-circle', tone: 'deal' });
  });

  it('re-ranking low → Reconnu à la forme', () => {
    expect(scanChip('low', makeRead({ textRead: false, visualMatch: true })).label).toBe('Reconnu à la forme');
  });

  it('rétrocompat v3 (textRead absent) + high → Correspondance', () => {
    expect(scanChip('high', makeRead()).label).toBe('Correspondance');
  });
});

describe('scanReadLine', () => {
  it('lecture identique au héros → null', () => {
    expect(scanReadLine(makeRead({ textRead: true }), makeTop())).toBeNull();
  });

  it('lecture différente du héros → Lu : …', () => {
    expect(scanReadLine(makeRead({ textRead: true, nom: 'Ultra Male' }), makeTop()))
      .toEqual({ prefix: 'Lu : ', text: 'Jean Paul Gaultier · Ultra Male' });
  });

  it('forme non vérifiée, hypothèse == héros → visible (cas dangereux)', () => {
    expect(scanReadLine(makeRead({ textRead: false }), makeTop()))
      .toEqual({ prefix: 'Hypothèse : ', text: 'Jean Paul Gaultier · Le Male' });
  });

  it('forme vérifiée par re-ranking, nom == héros → masquée', () => {
    expect(scanReadLine(makeRead({ textRead: false, visualMatch: true }), makeTop())).toBeNull();
  });

  it('pas de read ou pas de top → null', () => {
    expect(scanReadLine(null, makeTop())).toBeNull();
    expect(scanReadLine(makeRead(), undefined)).toBeNull();
  });
});
