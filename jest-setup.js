// jest-setup.js — ParfumScan test environment

// Mock Reanimated
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (v) => ({ value: v }),
  useAnimatedStyle: () => ({}),
  useAnimatedProps: () => ({}),
  useDerivedValue: (fn) => ({ value: fn() }),
  useAnimatedReaction: () => {},
  withSpring: (v) => v,
  withTiming: (v) => v,
  withRepeat: (v) => v,
  withDelay: (_, v) => v,
  cancelAnimation: () => {},
  runOnJS: (fn) => fn,
  makeMutable: (v) => ({ value: v }),
  isSharedValue: () => false,
  setUpTests: () => {},
  Easing: { out: (x) => x, inOut: (x) => x, linear: (x) => x, ease: (x) => x },
  Layout: { duration: 300 },
  SlideInLeft: { duration: 300 },
  SlideOutRight: { duration: 300 },
  FadeIn: { duration: 300 },
  FadeOut: { duration: 300 },
  createAnimatedComponent: (c) => c,
  FlatList: 'FlatList',
  ScrollView: 'ScrollView',
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  default: {
    View: 'View', Text: 'Text', Image: 'Image',
    ScrollView: 'ScrollView', FlatList: 'FlatList',
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

// Mock NativeEventEmitter pour expo-modules-core
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  const { EventEmitter } = require('events');
  return { default: EventEmitter };
});
