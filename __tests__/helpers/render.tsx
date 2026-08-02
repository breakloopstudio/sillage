import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/theme/ThemeContext';

jest.mock('../../src/services/theme-storage', () => ({
  getThemeMode: () => Promise.resolve('system'),
  setThemeMode: () => Promise.resolve(),
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

export async function renderWithTheme(ui: React.ReactElement) {
  const result = render(ui, { wrapper: Wrapper });
  await waitFor(() => expect(screen.toJSON()).toBeTruthy(), { timeout: 2000 });
  return result;
}
