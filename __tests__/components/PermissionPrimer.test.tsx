import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import PermissionPrimer from '../../src/components/PermissionPrimer';
import { PERMISSION_PRIMERS } from '../../src/utils/permission-primers';
import { ThemeProvider } from '../../src/theme/ThemeContext';
import { renderWithTheme } from '../helpers/render';

jest.mock('../../src/services/haptics', () => ({
  hapticsLight: jest.fn(),
  hapticsSuccess: jest.fn(),
  hapticsError: jest.fn(),
}));

describe('PermissionPrimer', () => {
  it('ne rend rien quand visible=false', async () => {
    // Render direct (pas renderWithTheme) : le composant retourne null quand
    // visible=false, donc screen.toJSON() est null et le helper timeouterait.
    render(
      <ThemeProvider>
        <PermissionPrimer
          visible={false}
          copy={PERMISSION_PRIMERS.camera}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
        />
      </ThemeProvider>,
    );
    // Laisse le ThemeProvider s'initialiser (AsyncStorage mock → 'system').
    await act(async () => { await new Promise(r => setTimeout(r, 20)); });
    expect(screen.queryByText(PERMISSION_PRIMERS.camera.title)).toBeNull();
    expect(screen.queryByText('Pas maintenant')).toBeNull();
  });

  it('affiche le titre, le message et la réassurance quand visible', async () => {
    await renderWithTheme(
      <PermissionPrimer
        visible
        copy={PERMISSION_PRIMERS.camera}
        onAccept={jest.fn()}
        onDecline={jest.fn()}
      />,
    );
    expect(screen.getByText(PERMISSION_PRIMERS.camera.title)).toBeTruthy();
    expect(screen.getByText(PERMISSION_PRIMERS.camera.message)).toBeTruthy();
    expect(screen.getByText(/changer d'avis à tout moment/)).toBeTruthy();
  });

  it('appelle onAccept au tap sur le CTA', async () => {
    const onAccept = jest.fn();
    await renderWithTheme(
      <PermissionPrimer
        visible
        copy={PERMISSION_PRIMERS.mic}
        onAccept={onAccept}
        onDecline={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByText(PERMISSION_PRIMERS.mic.acceptLabel));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('appelle onDecline au tap sur « Pas maintenant »', async () => {
    const onDecline = jest.fn();
    await renderWithTheme(
      <PermissionPrimer
        visible
        copy={PERMISSION_PRIMERS.push}
        onAccept={jest.fn()}
        onDecline={onDecline}
      />,
    );
    fireEvent.press(screen.getByText('Pas maintenant'));
    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('chaque permission a son label CTA dédié', async () => {
    for (const key of ['camera', 'location', 'push'] as const) {
      const { unmount } = await renderWithTheme(
        <PermissionPrimer
          visible
          copy={PERMISSION_PRIMERS[key]}
          onAccept={jest.fn()}
          onDecline={jest.fn()}
        />,
      );
      expect(screen.getByText(PERMISSION_PRIMERS[key].acceptLabel)).toBeTruthy();
      unmount();
    }
  });
});
