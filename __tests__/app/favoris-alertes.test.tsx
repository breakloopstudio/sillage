// __tests__/app/favoris-alertes.test.tsx — Vue Alertes : carte veille, jauge,
// chip fusionnée, caption info, suggestions, menu long-press.

import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react-native';
import { renderWithTheme } from '../helpers/render';
import { formatVariation } from '../../src/utils/price-alerts';
import { formatPrice } from '../../src/utils/format-price';
import type { UserFavori } from '../../src/models';
import type { UserPriceAlert } from '../../src/models/user-price-alert.interface';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../src/contexts/AuthContext', () => ({
  useAuthContext: () => ({ user: { uid: 'u1' }, authReady: true, isAuthenticated: true }),
}));

const mockFavorisState = {
  favoris: [
    { id: 'f1', parfumId: 'p1', nom: 'Nom One', marque: 'Marque One', imageUrl: null, bestPrice: 80, referencePrice: 100, addedAt: new Date() },
    { id: 'f2', parfumId: 'p2', nom: 'Nom Two', marque: 'Marque Two', imageUrl: null, bestPrice: 90, referencePrice: 90, addedAt: new Date() },
    { id: 'f3', parfumId: 'sg1', nom: 'Suggestion One', marque: 'Marque Sg', imageUrl: null, bestPrice: 120, referencePrice: 150, addedAt: new Date() },
  ] as UserFavori[],
};
jest.mock('../../src/contexts/FavorisContext', () => ({
  useFavorisContext: () => ({
    favoris: mockFavorisState.favoris,
    favIds: new Set(mockFavorisState.favoris.map(f => f.parfumId)),
    loading: false,
    isFav: () => true,
    toggleFav: jest.fn(),
    removeFavori: jest.fn(),
  }),
}));

const mockUserParfumState = {
  items: [] as unknown[],
  statusByParfumId: new Map<string, string>(),
};
jest.mock('../../src/contexts/UserParfumContext', () => ({
  useUserParfumContext: () => ({
    items: mockUserParfumState.items,
    loading: false,
    add: jest.fn(),
    update: jest.fn(),
    statusByParfumId: mockUserParfumState.statusByParfumId,
  }),
}));

const mockSetAlert = jest.fn(() => Promise.resolve());
const mockAlertsState = {
  alerts: [
    { parfumId: 'p1', targetPrice: 60, initialPrice: 100, lastPrice: 80, lastChecked: new Date(Date.now() - 2 * 3600000), addedAt: new Date() },
    { parfumId: 'p2', targetPrice: null, initialPrice: 90, lastPrice: 90, lastChecked: new Date(Date.now() - 2 * 3600000), addedAt: new Date() },
  ] as UserPriceAlert[],
  byParfumId: new Map<string, UserPriceAlert>(),
};
mockAlertsState.byParfumId = new Map(mockAlertsState.alerts.map(a => [a.parfumId, a]));
jest.mock('../../src/contexts/PriceAlertsContext', () => ({
  usePriceAlertsContext: () => ({
    alerts: mockAlertsState.alerts,
    byParfumId: mockAlertsState.byParfumId,
    loading: false,
    setAlert: mockSetAlert,
  }),
}));

jest.mock('../../src/features/navigation/NavigationChromeContext', () => ({
  useNavigationChrome: () => ({ scrollY: { value: 0 }, resetDock: jest.fn() }),
}));

jest.mock('../../src/hooks/usePushPrimer', () => ({
  usePushPrimer: () => ({ visible: false, propose: jest.fn(), accept: jest.fn(), decline: jest.fn() }),
}));

jest.mock('../../src/hooks/useFavorisViewPreference', () => ({
  useFavorisViewPreference: () => ({ view: 'alerts', setView: jest.fn() }),
}));

jest.mock('../../src/hooks/useDensityPreference', () => ({
  useDensityPreference: () => ({ density: 'comfortable', setDensity: jest.fn() }),
  GRID_MODES: [],
}));

const mockGetParfumById = jest.fn().mockResolvedValue(null);
const mockGetParfumsByIds = jest.fn().mockResolvedValue([]);
jest.mock('../../src/services/catalog', () => ({
  getParfumsByIds: (...args: unknown[]) => mockGetParfumsByIds(...args),
  getParfumById: (...args: unknown[]) => mockGetParfumById(...args),
}));

const mockGetLowestObservedPrices = jest.fn().mockResolvedValue(new Map([['p1', 70]]));
jest.mock('../../src/services/user-data', () => ({
  getLowestObservedPrices: (...args: unknown[]) => mockGetLowestObservedPrices(...args),
}));

const mockSetPendingParfum = jest.fn();
jest.mock('../../src/services/catalog-bridge', () => ({
  setPendingParfum: (...args: unknown[]) => mockSetPendingParfum(...args),
}));

jest.mock('../../src/services/haptics', () => ({
  hapticsLight: jest.fn(),
  hapticsError: jest.fn(),
  hapticsSuccess: jest.fn(),
}));

jest.mock('../../src/components/FavoriSheet', () => {
  return { __esModule: true, default: () => null };
});

jest.mock('../../src/components/PermissionPrimer', () => {
  return { __esModule: true, default: () => null };
});

jest.mock('../../src/components/ParfumCard', () => {
  return { __esModule: true, default: () => null };
});

jest.mock('../../src/components/PriceAlertSheet', () => {
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible, parfumId }: { visible: boolean; parfumId: string }) =>
      visible ? <Pressable testID={`price-alert-sheet-${parfumId}`}><Text>sheet</Text></Pressable> : null,
  };
});

jest.mock('../../src/components/ActionSheet', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible, actions }: { visible: boolean; actions: Array<{ label: string; onPress: () => void }> }) =>
      visible ? (
        <View>
          {actions.map((a: { label: string; onPress: () => void }) => (
            <Pressable key={a.label} testID={`action-${a.label}`} onPress={a.onPress}>
              <Text>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null,
  };
});

import FavorisPage from '../../app/(tabs)/favoris';

async function renderAlerts() {
  await renderWithTheme(<FavorisPage />);
  await act(async () => { await Promise.resolve(); });
}

describe('Favoris — vue Alertes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLowestObservedPrices.mockResolvedValue(new Map([['p1', 70]]));
    mockGetParfumById.mockResolvedValue(null);
    mockGetParfumsByIds.mockResolvedValue([]);
  });

  it('carte veille : totaux actives / atteintes / économie', async () => {
    await renderAlerts();
    const watchCard = await screen.findByLabelText(/alertes actives/);
    expect(watchCard.props.accessibilityLabel).toContain('20');
    expect(screen.getByText('Actives')).toBeTruthy();
    expect(screen.getByText('Atteintes')).toBeTruthy();
    expect(screen.getByText('Économie')).toBeTruthy();
  });

  it('jauge de progression vers la cible (50 %)', async () => {
    await renderAlerts();
    expect(await screen.findByLabelText(/Progression vers ta cible : 50 %/)).toBeTruthy();
  });

  it('chip fusionnée variation + baisse absolue', async () => {
    await renderAlerts();
    const chip = `${formatVariation(-0.2)} · \u2212${formatPrice(20, { decimals: 0 })}`;
    expect(await screen.findByText(chip)).toBeTruthy();
  });

  it('caption : plus bas constaté + dernière vérification', async () => {
    await renderAlerts();
    expect(await screen.findByText(/Plus bas constaté : 70 €/)).toBeTruthy();
    expect(screen.getAllByText(/vérifié il y a 2 h/).length).toBeGreaterThanOrEqual(1);
  });

  it('suggestions : favori sans alerte → ouvre la PriceAlertSheet', async () => {
    await renderAlerts();
    expect(await screen.findByText('À surveiller peut-être')).toBeTruthy();
    expect(screen.getByText('Suggestion One')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText(/Créer une alerte pour/));
    });
    expect(screen.getByTestId('price-alert-sheet-sg1')).toBeTruthy();
  });

  it('long-press carte → menu, désactiver → setAlert(parfumId, false)', async () => {
    await renderAlerts();
    const card = await screen.findByLabelText(/Marque One Nom One/);
    await act(async () => {
      fireEvent(card, 'longPress');
    });
    expect(screen.getByTestId('action-Désactiver l\u2019alerte')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('action-Désactiver l\u2019alerte'));
    });
    expect(mockSetAlert).toHaveBeenCalledWith('p1', false);
  });

  it('menu long-press : Voir la fiche → setPendingParfum + navigation', async () => {
    mockGetParfumById.mockResolvedValue({ id: 'p1', nom: 'Nom One', marque: 'Marque One' });
    await renderAlerts();
    const card = await screen.findByLabelText(/Marque One Nom One/);
    await act(async () => {
      fireEvent(card, 'longPress');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('action-Voir la fiche'));
    });
    expect(mockSetPendingParfum).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/catalog/p1');
  });

  it('menu long-press : Modifier → PriceAlertSheet existante', async () => {
    await renderAlerts();
    const card = await screen.findByLabelText(/Marque One Nom One/);
    await act(async () => {
      fireEvent(card, 'longPress');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('action-Modifier l’alerte'));
    });
    expect(screen.getByTestId('price-alert-sheet-p1')).toBeTruthy();
  });
});
