// Attempt to import tokens, with full fallbacks if unavailable
let tokens = {};
try {
  tokens = require("@mindscript/ui/tokens");
} catch (e) {
  console.warn("Could not load @mindscript/ui/tokens, using fallbacks");
}

// Design tokens with complete fallbacks
const colors = tokens.colors || {};
const typography = tokens.typography || {};
const spacing = tokens.spacing || {};
const borderRadius = tokens.borderRadius || {};
const shadows = tokens.shadows || {};
const gradients = tokens.gradients || {};
const extended = colors.extended || {};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: colors.primary || "#6C63FF",
        accent: colors.accent || "#10B981",
        background: colors.background || "#F7F8FC",
        surface: colors.surface || "#FFFFFF",
        text: colors.text || "#0F172A",
        soft: colors.soft || "#FDE68A",
        error: colors.error || "#EF4444",
        warning: colors.warning || "#F59E0B",
        success: colors.success || "#10B981",
        muted: colors.muted || "#6B7280",
        // Extended therapeutic palette
        'primary-light': extended.primaryLight || '#A5A0FF',
        'accent-light': extended.accentLight || '#34D399',
        'warm-cream': extended.warmCream || '#FDF8F3',
        'soft-lavender': extended.softLavender || '#EDE9FE',
        'calm-mint': extended.calmMint || '#D1FAE5',
        'deep-purple': extended.deepPurple || '#4C1D95',
        'warm-gold': extended.warmGold || '#D97706',
        'soft-pink': extended.softPink || '#FDF2F8',
        'ocean-blue': extended.oceanBlue || '#0EA5E9',
      },
      fontFamily: typography.fontFamily || {
        heading: "Sora, system-ui, sans-serif",
        body: "Inter, system-ui, sans-serif",
      },
      fontSize: typography.fontSize || {
        xs: "0.75rem",
        sm: "0.875rem",
        base: "1rem",
        lg: "1.125rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.875rem",
        "4xl": "2.25rem",
      },
      fontWeight: typography.fontWeight || {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      lineHeight: typography.lineHeight || {
        tight: "1.15",
        normal: "1.5",
        relaxed: "1.75",
      },
      spacing: Object.keys(spacing).length ? spacing : {
        1: "0.25rem",
        2: "0.5rem",
        3: "0.75rem",
        4: "1rem",
        6: "1.5rem",
        8: "2rem",
        12: "3rem",
        16: "4rem",
        20: "5rem",
      },
      borderRadius: Object.keys(borderRadius).length ? borderRadius : {
        sm: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
      boxShadow: Object.keys(shadows).length ? shadows : {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
        lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
        soft: "0 8px 24px rgba(15, 23, 42, 0.08)",
        glowPrimary: "0 0 20px rgba(108, 99, 255, 0.3), 0 0 40px rgba(108, 99, 255, 0.1)",
        glowAccent: "0 0 20px rgba(16, 185, 129, 0.3), 0 0 40px rgba(16, 185, 129, 0.1)",
        glowSoft: "0 0 30px rgba(253, 230, 138, 0.4)",
        cardHover: "0 20px 40px rgba(15, 23, 42, 0.12), 0 8px 16px rgba(15, 23, 42, 0.08)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.06)",
      },
      backgroundImage: {
        'warm-aura': gradients.warmAura || 'linear-gradient(135deg, #F8F6FF 0%, #FDF8F3 50%, #F0FDF4 100%)',
        'calm-purple': gradients.calmPurple || 'linear-gradient(180deg, #EDE9FE 0%, #F8F6FF 100%)',
        'energy-glow': gradients.energyGlow || 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
        'deep-space': gradients.deepSpace || 'linear-gradient(180deg, #1E1B4B 0%, #312E81 50%, #4C1D95 100%)',
        'sunrise': gradients.sunrise || 'linear-gradient(135deg, #FDF8F3 0%, #FDE68A 30%, #F8F6FF 100%)',
        'ocean-calm': gradients.oceanCalm || 'linear-gradient(180deg, #EFF6FF 0%, #DBEAFE 50%, #D1FAE5 100%)',
        'hero-background': gradients.heroBackground || 'linear-gradient(135deg, #F8F6FF 0%, #FDF8F3 25%, #EDE9FE 50%, #D1FAE5 75%, #F0FDF4 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        // Therapeutic animations
        'breathe': 'breathe 4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out infinite 2s',
        'float-slow': 'float 8s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'slide-up-fade': 'slideUpFade 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glowPulse: {
          '0%, 100%': {
            boxShadow: '0 0 20px rgba(108, 99, 255, 0.3), 0 0 40px rgba(108, 99, 255, 0.1)',
            opacity: '0.9'
          },
          '50%': {
            boxShadow: '0 0 30px rgba(108, 99, 255, 0.5), 0 0 60px rgba(108, 99, 255, 0.2)',
            opacity: '1'
          },
        },
        slideUpFade: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      transitionTimingFunction: {
        'therapeutic': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
