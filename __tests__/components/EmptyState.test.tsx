import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/theme/ThemeContext';
import EmptyState from '../../src/components/EmptyState';

jest.mock('../../src/services/theme-storage', () => ({
  getThemeMode: () => Promise.resolve('system'),
  setThemeMode: () => Promise.resolve(),
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

async function renderWithTheme(ui: React.ReactElement) {
  const result = render(ui, { wrapper: Wrapper });
  await waitFor(() => expect(screen.toJSON()).toBeTruthy(), { timeout: 2000 });
  return result;
}

describe('EmptyState', () => {
  const onAction = jest.fn();

  beforeEach(() => {
    onAction.mockClear();
  });

  describe('variant: collection', () => {
    it('renders correct title', async () => {
      await renderWithTheme(<EmptyState variant="collection" onAction={onAction} />);
      expect(screen.getByText('Ta collection est vide')).toBeTruthy();
    });

    it('renders correct description', async () => {
      await renderWithTheme(<EmptyState variant="collection" onAction={onAction} />);
      expect(screen.getByText(/inventaire personnel/)).toBeTruthy();
    });

    it('has CTA with correct text', async () => {
      await renderWithTheme(<EmptyState variant="collection" onAction={onAction} />);
      expect(screen.getByText('Explorer le catalogue')).toBeTruthy();
    });

    it('CTA calls onAction', async () => {
      await renderWithTheme(<EmptyState variant="collection" onAction={onAction} />);
      fireEvent.press(screen.getByText('Explorer le catalogue'));
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('variant: favoris', () => {
    it('renders correct title', async () => {
      await renderWithTheme(<EmptyState variant="favoris" onAction={onAction} />);
      expect(screen.getByText("Ton nez n'a pas encore de coup de cœur")).toBeTruthy();
    });
  });

  describe('variant: historique', () => {
    it('renders correct title', async () => {
      await renderWithTheme(<EmptyState variant="historique" onAction={onAction} />);
      expect(screen.getByText("Aucun scan pour l'instant")).toBeTruthy();
    });

    it('has correct CTA text', async () => {
      await renderWithTheme(<EmptyState variant="historique" onAction={onAction} />);
      expect(screen.getByText('Scanner un flacon')).toBeTruthy();
    });
  });

  describe('variant: wardrobe', () => {
    it('renders correct title', async () => {
      await renderWithTheme(<EmptyState variant="wardrobe" onAction={onAction} />);
      expect(screen.getByText('Votre parfumerie est vide')).toBeTruthy();
    });
  });

  it('calls onAction when CTA button is pressed', async () => {
    await renderWithTheme(<EmptyState variant="favoris" onAction={onAction} />);
    fireEvent.press(screen.getByText('Explorer le catalogue'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
