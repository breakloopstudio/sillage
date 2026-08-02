import React from 'react';
import { screen, fireEvent } from '@testing-library/react-native';
import Button from '../../src/components/Button';
import { renderWithTheme } from '../helpers/render';

describe('Button', () => {
  describe('primary', () => {
    it('renders children as text', async () => {
      await renderWithTheme(<Button onPress={jest.fn()}>Valider</Button>);
      expect(screen.getByText('Valider')).toBeTruthy();
    });

    it('calls onPress when pressed', async () => {
      const onPress = jest.fn();
      await renderWithTheme(<Button onPress={onPress}>Valider</Button>);
      fireEvent.press(screen.getByText('Valider'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', async () => {
      const onPress = jest.fn();
      await renderWithTheme(<Button onPress={onPress} disabled>Valider</Button>);
      fireEvent.press(screen.getByText('Valider'));
      expect(onPress).not.toHaveBeenCalled();
    });

    it('does not call onPress when loading', async () => {
      const onPress = jest.fn();
      await renderWithTheme(<Button onPress={onPress} loading>Valider</Button>);
      fireEvent.press(screen.getByText('Valider'));
      expect(onPress).not.toHaveBeenCalled();
    });

    it('still renders text when loading', async () => {
      await renderWithTheme(<Button onPress={jest.fn()} loading>Valider</Button>);
      expect(screen.getByText('Valider')).toBeTruthy();
    });
  });

  describe('outline', () => {
    it('renders children', async () => {
      await renderWithTheme(<Button variant="outline" onPress={jest.fn()}>Annuler</Button>);
      expect(screen.getByText('Annuler')).toBeTruthy();
    });

    it('calls onPress', async () => {
      const onPress = jest.fn();
      await renderWithTheme(<Button variant="outline" onPress={onPress}>Annuler</Button>);
      fireEvent.press(screen.getByText('Annuler'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('ghost', () => {
    it('renders children', async () => {
      await renderWithTheme(<Button variant="ghost" onPress={jest.fn()}>Retour</Button>);
      expect(screen.getByText('Retour')).toBeTruthy();
    });

    it('calls onPress', async () => {
      const onPress = jest.fn();
      await renderWithTheme(<Button variant="ghost" onPress={onPress}>Retour</Button>);
      fireEvent.press(screen.getByText('Retour'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('secondary', () => {
    it('renders children', async () => {
      await renderWithTheme(<Button variant="secondary" onPress={jest.fn()}>Acheter</Button>);
      expect(screen.getByText('Acheter')).toBeTruthy();
    });
  });

  describe('with icon', () => {
    it('renders text alongside icon', async () => {
      await renderWithTheme(<Button onPress={jest.fn()} icon="cart-outline">Acheter</Button>);
      expect(screen.getByText('Acheter')).toBeTruthy();
    });
  });

  describe('disabled', () => {
    it('renders ghost variant when disabled', async () => {
      await renderWithTheme(<Button variant="ghost" onPress={jest.fn()} disabled>Retour</Button>);
      expect(screen.getByText('Retour')).toBeTruthy();
    });
  });
});
