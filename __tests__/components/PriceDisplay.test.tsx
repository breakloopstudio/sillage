import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/theme/ThemeContext';
import PriceDisplay from '../../src/components/PriceDisplay';
import { formatPrice } from '../../src/utils/format-price';

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

describe('PriceDisplay', () => {
  it('renders the best price with euro symbol', async () => {
    await renderWithTheme(<PriceDisplay bestPrice={89.99} animated={false} />);
    expect(screen.getByText(formatPrice(89.99))).toBeTruthy();
  });

  it('shows reference price crossed out when lower than best', async () => {
    await renderWithTheme(<PriceDisplay bestPrice={89.99} referencePrice={120.00} animated={false} />);
    expect(screen.getByText(formatPrice(120.00))).toBeTruthy();
  });

  it('does not show reference price if equal to best', async () => {
    const { queryByText } = await renderWithTheme(
      <PriceDisplay bestPrice={100} referencePrice={100} animated={false} />
    );
    expect(queryByText(formatPrice(100))).toBeTruthy();
  });

  describe('deal (ratio < 0.8)', () => {
    it('shows discount badge', async () => {
      await renderWithTheme(<PriceDisplay bestPrice={70} referencePrice={100} animated={false} />);
      expect(screen.getByText('\u221230 %')).toBeTruthy();
    });

    it('shows "Bonne affaire" label', async () => {
      await renderWithTheme(<PriceDisplay bestPrice={70} referencePrice={100} animated={false} />);
      expect(screen.getByText('Bonne affaire')).toBeTruthy();
    });
  });

  describe('fair (0.8 <= ratio <= 1.05)', () => {
    it('shows "Prix correct" label at ratio 0.85', async () => {
      await renderWithTheme(<PriceDisplay bestPrice={85} referencePrice={100} animated={false} />);
      expect(screen.getByText('Prix correct')).toBeTruthy();
    });

    it('shows discount badge when best < ref', async () => {
      await renderWithTheme(<PriceDisplay bestPrice={95} referencePrice={100} animated={false} />);
      expect(screen.getByText('\u22125 %')).toBeTruthy();
    });
  });

  describe('overpriced (ratio > 1.05)', () => {
    it('shows "Trop cher" label', async () => {
      await renderWithTheme(<PriceDisplay bestPrice={120} referencePrice={100} animated={false} />);
      expect(screen.getByText('Trop cher')).toBeTruthy();
    });

    it('does not show discount badge when overpriced', async () => {
      const { queryByText } = await renderWithTheme(
        <PriceDisplay bestPrice={120} referencePrice={100} animated={false} />
      );
      expect(queryByText(/-%/)).toBeNull();
    });
  });

  describe('unknown (no reference price)', () => {
    it('shows only best price without label', async () => {
      const { queryByText } = await renderWithTheme(
        <PriceDisplay bestPrice={89.99} animated={false} />
      );
      expect(screen.getByText(formatPrice(89.99))).toBeTruthy();
      expect(queryByText('Bonne affaire')).toBeNull();
      expect(queryByText('Prix correct')).toBeNull();
      expect(queryByText('Trop cher')).toBeNull();
    });

    it('reference price of 0 is treated as absent', async () => {
      const { queryByText } = await renderWithTheme(
        <PriceDisplay bestPrice={89.99} referencePrice={0} animated={false} />
      );
      expect(queryByText('Bonne affaire')).toBeNull();
    });
  });

  describe('explicit priceValue', () => {
    it('uses explicit priceValue over calculation', async () => {
      await renderWithTheme(
        <PriceDisplay bestPrice={120} referencePrice={100} priceValue="deal" animated={false} />
      );
      expect(screen.getByText('Bonne affaire')).toBeTruthy();
    });
  });

  describe('large mode', () => {
    it('renders with larger text', async () => {
      await renderWithTheme(<PriceDisplay bestPrice={89.99} large animated={false} />);
      expect(screen.getByText(formatPrice(89.99))).toBeTruthy();
    });
  });

  describe('discount calculation', () => {
    it('rounds percentage correctly', async () => {
      await renderWithTheme(
        <PriceDisplay bestPrice={66.66} referencePrice={99.99} animated={false} />
      );
      expect(screen.getByText('\u221233 %')).toBeTruthy();
    });

    it('does not show badge for >95% discount', async () => {
      const { queryByText } = await renderWithTheme(
        <PriceDisplay bestPrice={3} referencePrice={100} animated={false} />
      );
      expect(queryByText(/-97%/)).toBeNull();
    });

    it('does not show badge for 0% discount', async () => {
      const { queryByText } = await renderWithTheme(
        <PriceDisplay bestPrice={100} referencePrice={100} animated={false} />
      );
      expect(queryByText(/-%/)).toBeNull();
    });
  });
});
