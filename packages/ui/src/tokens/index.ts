// Design tokens from PRD - "Therapeutic Warmth" aesthetic
export const colors = {
  primary: "#6C63FF",
  accent: "#10B981",
  background: "#F7F8FC",
  surface: "#FFFFFF",
  text: "#0F172A",
  soft: "#FDE68A",
  // Additional semantic colors
  error: "#EF4444",
  warning: "#F59E0B",
  success: "#10B981",
  muted: "#6B7280",
  // Extended therapeutic palette
  extended: {
    primaryLight: "#A5A0FF",
    primaryGlow: "rgba(108, 99, 255, 0.2)",
    accentLight: "#34D399",
    accentGlow: "rgba(16, 185, 129, 0.2)",
    warmCream: "#FDF8F3",
    softLavender: "#EDE9FE",
    calmMint: "#D1FAE5",
    deepPurple: "#4C1D95",
    warmGold: "#D97706",
    softPink: "#FDF2F8",
    oceanBlue: "#0EA5E9",
  },
} as const;

// Gradient definitions for atmospheric backgrounds
export const gradients = {
  warmAura: "linear-gradient(135deg, #F8F6FF 0%, #FDF8F3 50%, #F0FDF4 100%)",
  calmPurple: "linear-gradient(180deg, #EDE9FE 0%, #F8F6FF 100%)",
  energyGlow: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
  deepSpace: "linear-gradient(180deg, #1E1B4B 0%, #312E81 50%, #4C1D95 100%)",
  sunrise: "linear-gradient(135deg, #FDF8F3 0%, #FDE68A 30%, #F8F6FF 100%)",
  oceanCalm: "linear-gradient(180deg, #EFF6FF 0%, #DBEAFE 50%, #D1FAE5 100%)",
  heroBackground: "linear-gradient(135deg, #F8F6FF 0%, #FDF8F3 25%, #EDE9FE 50%, #D1FAE5 75%, #F0FDF4 100%)",
} as const;

export const typography = {
  fontFamily: {
    heading: "Sora, system-ui, sans-serif",
    body: "Inter, system-ui, sans-serif",
  },
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.15",
    normal: "1.5",
    relaxed: "1.75",
  },
} as const;

export const spacing = {
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  6: "1.5rem",
  8: "2rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
} as const;

export const borderRadius = {
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  "2xl": "1rem",
  full: "9999px",
} as const;

export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
  soft: "0 8px 24px rgba(15, 23, 42, 0.08)",
  // Glow shadows for therapeutic warmth
  glowPrimary: "0 0 20px rgba(108, 99, 255, 0.3), 0 0 40px rgba(108, 99, 255, 0.1)",
  glowAccent: "0 0 20px rgba(16, 185, 129, 0.3), 0 0 40px rgba(16, 185, 129, 0.1)",
  glowSoft: "0 0 30px rgba(253, 230, 138, 0.4)",
  cardHover: "0 20px 40px rgba(15, 23, 42, 0.12), 0 8px 16px rgba(15, 23, 42, 0.08)",
  glass: "0 8px 32px rgba(0, 0, 0, 0.06)",
} as const;

export const animation = {
  duration: {
    fast: "180ms",
    normal: "220ms",
    slow: "300ms",
  },
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;