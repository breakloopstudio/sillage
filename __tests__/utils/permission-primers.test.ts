import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PERMISSION_PRIMERS,
  getPrimerReassurance,
  hasSeenPrimer,
  markPrimerSeen,
  type PermissionPrimerKey,
} from '../../src/utils/permission-primers';

const KEYS: PermissionPrimerKey[] = ['camera', 'mic', 'location', 'push'];

describe('PERMISSION_PRIMERS (copy)', () => {
  it('définit un primer pour chaque permission', () => {
    for (const key of KEYS) {
      expect(PERMISSION_PRIMERS[key]).toBeDefined();
    }
  });

  it('chaque primer a une icône, un titre, un message et un label', () => {
    for (const key of KEYS) {
      const copy = PERMISSION_PRIMERS[key];
      expect(copy.icon.length).toBeGreaterThan(0);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.message.length).toBeGreaterThan(0);
      expect(copy.acceptLabel.length).toBeGreaterThan(0);
    }
  });

  it('aucun point d\'exclamation dans la copy (voix éditoriale)', () => {
    for (const key of KEYS) {
      const copy = PERMISSION_PRIMERS[key];
      expect(copy.title).not.toContain('!');
      expect(copy.message).not.toContain('!');
      expect(copy.acceptLabel).not.toContain('!');
    }
    expect(getPrimerReassurance()).not.toContain('!');
  });

  it('la réassurance mentionne le retrait du consentement', () => {
    expect(getPrimerReassurance()).toContain('Paramètres');
    expect(getPrimerReassurance()).toContain('Confidentialité');
  });
});

describe('flags AsyncStorage', () => {
  beforeEach(() => {
    (AsyncStorage.getItem as jest.Mock).mockClear();
    (AsyncStorage.setItem as jest.Mock).mockClear();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('hasSeenPrimer lit la clé préfixée', async () => {
    await hasSeenPrimer('camera');
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('@sillage/primer-camera');
  });

  it('hasSeenPrimer = false tant que le flag n\'est pas posé', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    expect(await hasSeenPrimer('mic')).toBe(false);
  });

  it('hasSeenPrimer = true quand le flag vaut "1"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1');
    expect(await hasSeenPrimer('push')).toBe(true);
  });

  it('hasSeenPrimer = true par sécurité en cas d\'erreur AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('boom'));
    expect(await hasSeenPrimer('location')).toBe(true);
  });

  it('markPrimerSeen pose le flag "1"', async () => {
    await markPrimerSeen('location');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@sillage/primer-location', '1');
  });

  it('markPrimerSeen ne throw pas en cas d\'erreur AsyncStorage', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('disk full'));
    await expect(markPrimerSeen('camera')).resolves.toBeUndefined();
  });
});
