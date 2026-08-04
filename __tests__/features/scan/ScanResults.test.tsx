// __tests__/features/scan/ScanResults.test.tsx — Héros « fiche express » :
// CTA fiche + cœur + cloche alerte prix (auth gate, sheet, setAlert).

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/theme/ThemeContext';
import { renderWithTheme } from '../../helpers/render';
import type { Parfum } from '../../../src/models';

const mockPush = jest.fn();
const mockDismissTo = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, dismissTo: mockDismissTo }),
}));

const mockSetPendingParfum = jest.fn();
jest.mock('../../../src/services/catalog-bridge', () => ({
  setPendingParfum: (...args: unknown[]) => mockSetPendingParfum(...args),
}));

const mockAuth = { user: { uid: 'u1', email: 'a@b.c', displayName: 'A', photoURL: null, providers: ['email'] }, isAuthenticated: true };
jest.mock('../../../src/contexts/AuthContext', () => ({
  useAuthContext: () => mockAuth,
}));

jest.mock('../../../src/contexts/FavorisContext', () => ({
  useFavorisContext: () => ({ favoris: [], favIds: new Set(), loading: false, isFav: () => false, toggleFav: jest.fn(), removeFavori: jest.fn() }),
}));

const mockSetAlert = jest.fn(() => Promise.resolve());
const mockAlertsState = { byParfumId: new Map() as Map<string, unknown> };
jest.mock('../../../src/contexts/PriceAlertsContext', () => ({
  usePriceAlertsContext: () => ({ alerts: [], byParfumId: mockAlertsState.byParfumId, loading: false, setAlert: mockSetAlert }),
}));

const mockPropose = jest.fn();
jest.mock('../../../src/hooks/usePushPrimer', () => ({
  usePushPrimer: () => ({ visible: false, propose: mockPropose, accept: jest.fn(), decline: jest.fn() }),
}));

jest.mock('../../../src/components/FavButton', () => {
  const { Pressable } = require('react-native');
  return { __esModule: true, default: () => <Pressable testID="fav-button" /> };
});

jest.mock('../../../src/components/PriceAlertSheet', () => {
  const { Pressable } = require('react-native');
  return {
    __esModule: true,
    default: (props: { visible: boolean; onSave: (active: boolean, target: number | null) => void }) =>
      props.visible ? <Pressable testID="alert-sheet" onPress={() => props.onSave(true, 85)} /> : null,
  };
});

jest.mock('../../../src/components/PermissionPrimer', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View /> };
});

jest.mock('../../../src/services/haptics', () => ({
  hapticsLight: jest.fn(),
  hapticsSuccess: jest.fn(),
  hapticsError: jest.fn(),
}));

import { ScanResults } from '../../../src/features/scan/ScanResults';

function makeParfum(overrides: Partial<Parfum> = {}): Parfum {
  return {
    id: 'p1',
    nom: 'Sauvage',
    marque: 'Dior',
    familleOlactive: 'aromatic',
    notesTete: ['Bergamot'],
    notesCoeur: [],
    notesFond: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    bestPrice: 89,
    referencePrice: 110,
    imageUrl: 'https://example.com/p1.webp',
    ...overrides,
  };
}

async function renderResults(parfums: Parfum[]) {
  return renderWithTheme(
    <ScanResults parfums={parfums} confidence="high" read={null} onOpenCatalog={jest.fn()} onRescan={jest.fn()} />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.isAuthenticated = true;
  mockAlertsState.byParfumId = new Map();
});

describe('ScanResults — fiche express', () => {
  it('rend le héros (marque, nom) et le CTA « Voir la fiche »', async () => {
    await renderResults([makeParfum()]);
    expect(screen.getByText('Dior')).toBeTruthy();
    expect(screen.getByText('Sauvage')).toBeTruthy();
    expect(screen.getByText('Voir la fiche')).toBeTruthy();
    expect(screen.getByTestId('fav-button')).toBeTruthy();
  });

  it('CTA « Voir la fiche » → pont setPendingParfum + dismissTo tabs', async () => {
    await renderResults([makeParfum()]);
    fireEvent.press(screen.getByText('Voir la fiche'));
    expect(mockSetPendingParfum).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)');
  });

  it('affiche la cloche alerte prix quand le héros a un prix', async () => {
    await renderResults([makeParfum()]);
    expect(screen.getByLabelText(/Alerte prix/)).toBeTruthy();
  });

  it("masque la cloche quand le héros n'a pas de prix", async () => {
    await renderResults([makeParfum({ bestPrice: undefined, referencePrice: undefined })]);
    expect(screen.queryByLabelText(/Alerte prix/)).toBeNull();
  });

  it('cloche déconnecté → redirection login, pas de sheet', async () => {
    mockAuth.isAuthenticated = false;
    await renderResults([makeParfum()]);
    fireEvent.press(screen.getByLabelText(/Alerte prix/));
    expect(mockPush).toHaveBeenCalledWith('/auth/login');
    expect(screen.queryByTestId('alert-sheet')).toBeNull();
  });

  it('cloche connecté → ouvre la PriceAlertSheet', async () => {
    await renderResults([makeParfum()]);
    fireEvent.press(screen.getByLabelText(/Alerte prix/));
    expect(screen.getByTestId('alert-sheet')).toBeTruthy();
  });

  it('sauvegarde → setAlert avec le prix du héros comme ancre + push primer proposé', async () => {
    await renderResults([makeParfum()]);
    fireEvent.press(screen.getByLabelText(/Alerte prix/));
    await act(async () => { fireEvent.press(screen.getByTestId('alert-sheet')); });
    expect(mockSetAlert).toHaveBeenCalledWith('p1', true, { currentPrice: 89, targetPrice: 85 });
    expect(mockPropose).toHaveBeenCalledTimes(1);
  });

  it('alerte existante → la cloche passe en état actif (icône pleine)', async () => {
    mockAlertsState.byParfumId = new Map([[ 'p1', { parfumId: 'p1', targetPrice: null, initialPrice: 89, lastPrice: 89, lastChecked: null, addedAt: new Date() } ]]);
    await renderResults([makeParfum()]);
    expect(screen.getByLabelText(/Alerte prix — Activée/)).toBeTruthy();
  });

  it('alerte atteinte (prix ≤ cible) → état « Objectif atteint »', async () => {
    mockAlertsState.byParfumId = new Map([[ 'p1', { parfumId: 'p1', targetPrice: 90, initialPrice: 110, lastPrice: 89, lastChecked: null, addedAt: new Date() } ]]);
    await renderResults([makeParfum()]);
    expect(screen.getByLabelText(/Alerte prix — Objectif atteint/)).toBeTruthy();
  });

  it('confiance low → bouton « reprendre la photo » rendu sous les actions', async () => {
    await renderWithTheme(
      <ScanResults parfums={[makeParfum()]} confidence="low" read={null} onOpenCatalog={jest.fn()} onRescan={jest.fn()} />,
    );
    expect(screen.getByText("Ce n'est pas ça ? Reprends la photo")).toBeTruthy();
    expect(screen.getByText('Voir la fiche')).toBeTruthy();
  });

  it('aucun résultat → rend null', async () => {
    render(
      <ThemeProvider>
        <ScanResults parfums={[]} onOpenCatalog={jest.fn()} onRescan={jest.fn()} />
      </ThemeProvider>,
    );
    await act(async () => { await new Promise(r => setTimeout(r, 30)); });
    expect(screen.toJSON()).toBeNull();
  });
});
