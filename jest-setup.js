// jest-setup.js — Sillage test environment

// Mock Reanimated
// Animations d'entrée/sortie chainables (FadeIn.duration(300), FadeInDown.delay(i).duration(260)…).
// Préfixe « mock » obligatoire : la factory jest.mock est hoistée.
const mockChainableAnim = () => {
  const a = {};
  for (const m of ['duration', 'delay', 'easing', 'springify', 'damping', 'stiffness', 'mass', 'randomDelay']) {
    a[m] = () => a;
  }
  return a;
};
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (v) => ({ value: v }),
  useAnimatedStyle: () => ({}),
  useAnimatedProps: () => ({}),
  useDerivedValue: (fn) => ({ value: fn() }),
  useAnimatedReaction: () => {},
  useAnimatedScrollHandler: (fn) => fn,
  useReducedMotion: () => false,
  withSpring: (v) => v,
  withTiming: (v) => v,
  withRepeat: (v) => v,
  withDelay: (_, v) => v,
  withSequence: (...args) => args[args.length - 1],
  cancelAnimation: () => {},
  runOnJS: (fn) => fn,
  makeMutable: (v) => ({ value: v }),
  isSharedValue: () => false,
  setUpTests: () => {},
  Easing: { out: (x) => x, in: (x) => x, inOut: (x) => x, linear: (x) => x, ease: (x) => x, cubic: (x) => x },
  Layout: { duration: 300 },
  SlideInLeft: mockChainableAnim(),
  SlideOutRight: mockChainableAnim(),
  SlideInRight: mockChainableAnim(),
  SlideOutLeft: mockChainableAnim(),
  FadeIn: mockChainableAnim(),
  FadeInDown: mockChainableAnim(),
  FadeInUp: mockChainableAnim(),
  FadeOut: mockChainableAnim(),
  FadeOutDown: mockChainableAnim(),
  FadeOutUp: mockChainableAnim(),
  ZoomIn: mockChainableAnim(),
  ZoomOut: mockChainableAnim(),
  createAnimatedComponent: (c) => c,
  FlatList: require('react-native').FlatList,
  ScrollView: 'ScrollView',
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  default: {
    View: 'View', Text: 'Text', Image: 'Image',
    ScrollView: 'ScrollView', FlatList: require('react-native').FlatList,
    createAnimatedComponent: (c) => c,
  },
}));

// Mock expo-blur
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});

// Mock AsyncStorage — custom mock pour controle total des appels
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  mergeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
  multiMerge: jest.fn(() => Promise.resolve()),
}));

// Mock Firebase — supprimé (migration Supabase Phase 5)

// Mock Supabase
jest.mock('@supabase/supabase-js', () => {
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve) => resolve({ data: [], error: null, count: 0 }),
  };
  const mockChannel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  };
  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => mockQueryBuilder),
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
      auth: {
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        signUp: jest.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
        signInWithPassword: jest.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
        signInWithIdToken: jest.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
        reauthenticate: jest.fn().mockResolvedValue({ error: null }),
      },
      realtime: { setAuth: jest.fn() },
      channel: jest.fn(() => mockChannel),
      removeChannel: jest.fn(),
      removeAllChannels: jest.fn(),
      storage: { from: jest.fn(() => ({ upload: jest.fn(), getPublicUrl: jest.fn() })) },
      functions: { invoke: jest.fn().mockResolvedValue({ data: null, error: null }) },
    })),
  };
});

// Mock react-native-url-polyfill (importé par supabase.ts)
jest.mock('react-native-url-polyfill/auto', () => ({}));

// Mock Google Sign-In (module natif)
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({ type: 'success', data: { idToken: 'mock-token' } }),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-file-system (File, Paths utilisés par account.supabase)
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ write: jest.fn() })),
  Paths: { cache: '/mock/cache/' },
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  EncodingType: { Base64: 'base64' },
}));

// Mock expo-camera
jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [{ granted: false }, jest.fn()],
}));

// Mock expo-font
jest.mock('expo-font', () => ({
  useFonts: () => [true],
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
}));

// Mock expo-localization (device-locale : STT + transcription multilingue)
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'fr-FR', languageCode: 'fr', regionCode: 'FR' }],
}));

// i18n — i18next initialisé en français (langue source) avant les tests.
// Les tests peuvent continuer à asserter le texte FR des composants.
// NB : on initialise via options.ts (module pur) et NON via src/i18n/index pour
// ne pas instancier le mock AsyncStorage global avant les jest.mock locaux des
// suites qui re-définissent leur propre mock (home-cache, SWR…).
const i18next = require('i18next');
const { initReactI18next } = require('react-i18next');
const { buildInitOptions } = require('./src/i18n/options');
const { SOURCE_LANGUAGE } = require('./src/i18n/config');

i18next.use(initReactI18next).init(buildInitOptions(SOURCE_LANGUAGE));

// Mock NativeEventEmitter pour expo-modules-core
// (__esModule requis : sans lui l'interop babel double le .default et FlatList casse)
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  const { EventEmitter } = require('events');
  return { __esModule: true, default: EventEmitter };
});
