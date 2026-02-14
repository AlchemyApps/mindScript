import { StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography, Shadows } from './constants';

export const theme = StyleSheet.create({
  // ── Containers ──
  screenContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  surface: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },

  // ── Typography ──
  h1: {
    ...Typography.h1,
    color: Colors.text,
  },
  h2: {
    ...Typography.h2,
    color: Colors.text,
  },
  h3: {
    ...Typography.h3,
    color: Colors.text,
  },
  body: {
    ...Typography.body,
    color: Colors.text,
  },
  bodyMuted: {
    ...Typography.body,
    color: Colors.muted,
  },
  bodySmall: {
    ...Typography.bodySmall,
    color: Colors.text,
  },
  caption: {
    ...Typography.caption,
    color: Colors.muted,
  },
  label: {
    ...Typography.label,
    color: Colors.text,
  },

  // ── Buttons ──
  buttonPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  buttonSecondary: {
    backgroundColor: Colors.softLavender,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonSecondaryText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600' as const,
  },

  // ── Inputs ──
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  inputFocused: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },

  // ── Layout helpers ──
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  spaceBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  center: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
