const { colors, typography, spacing, borderRadius, shadows } = require("./src/tokens");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        accent: colors.accent,
        background: colors.background,
        surface: colors.surface,
        text: colors.text,
        soft: colors.soft,
        error: colors.error,
        warning: colors.warning,
        success: colors.success,
        muted: colors.muted,
      },
      fontFamily: typography.fontFamily,
      fontSize: typography.fontSize,
      fontWeight: typography.fontWeight,
      lineHeight: typography.lineHeight,
      spacing,
      borderRadius,
      boxShadow: shadows,
    },
  },
  plugins: [],
};