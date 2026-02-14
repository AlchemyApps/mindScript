import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Colors (from DESIGN_SYSTEM.md) ──

export const Colors = {
  primary: '#6C63FF',
  primaryLight: '#A5A0FF',
  accent: '#10B981',
  accentLight: '#34D399',
  background: '#F7F8FC',
  surface: '#FFFFFF',
  text: '#0F172A',
  soft: '#FDE68A',
  muted: '#6B7280',

  // Extended therapeutic palette
  warmCream: '#FDF8F3',
  softLavender: '#EDE9FE',
  calmMint: '#D1FAE5',
  deepPurple: '#4C1D95',
  warmGold: '#D97706',
  softPink: '#FDF2F8',
  oceanBlue: '#0EA5E9',

  // Functional
  error: '#EF4444',
  errorLight: '#FEE2E2',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',

  // Neutral
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // Transparent
  overlay: 'rgba(0, 0, 0, 0.5)',
  glassBg: 'rgba(255, 255, 255, 0.85)',
} as const;

// ── Gradient configs (for expo-linear-gradient) ──

export const Gradients = {
  warmAura: {
    colors: ['#EDE9FE', '#FDF8F3', '#D1FAE5'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  calmPurple: {
    colors: ['#EDE9FE', '#F7F8FC'] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  deepSpace: {
    colors: ['#4C1D95', '#1F2937'] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  playerDefault: {
    colors: ['#EDE9FE', '#DDD6FE', '#C4B5FD'] as const,
    start: { x: 0, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  sunrise: {
    colors: ['#FDF8F3', '#FDE68A', '#F59E0B'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
} as const;

// ── Spacing ──

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ── Border Radius ──

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ── Typography ──

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
} as const;

// ── Shadows ──

export const Shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: {
      elevation: 1,
    },
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    android: {
      elevation: 3,
    },
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: {
      elevation: 6,
    },
  }),
} as const;

// ── Layout ──

export const Layout = {
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  tabBarHeight: 80,
  nowPlayingBarHeight: 64,
  statusBarOffset: Platform.OS === 'ios' ? 44 : 0,
} as const;
