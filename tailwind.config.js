/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  // Light-mode only — dark class is no longer applied
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Brand ────────────────────────────────────────────────────────────
        primary: {
          DEFAULT: '#3D5AFE',
          50:  '#EEF1FF',
          500: '#3D5AFE',
          600: '#2E4BE8',
          700: '#1E3AD1',
        },
        accent:  '#FF6584',
        success: '#30D158',
        danger:  '#FF3B30',
        warning: '#FF9F0A',

        // ── Neumorphic palette ────────────────────────────────────────────────
        // App root background
        surface: {
          DEFAULT:       'var(--surface)',
          dark:          'var(--surface)',
          card:          'var(--card)',
          light:         'var(--card)',
          'shadow-dark': 'var(--shadow-dark)',
          'shadow-light':'var(--shadow-light)',
        },

        // Semantic card background (replaces bg-white/5 on dark)
        card: 'var(--card)',

        // Text
        ink:    'var(--ink)',   // primary text (replaces text-white on neutral bg)
        muted:  'var(--muted)',   // secondary text

        // Subtle border
        subtle: 'var(--subtle)',
      },

      borderRadius: {
        lg:   '12px',
        xl:   '16px',
        '2xl':'20px',
        pill: '9999px',
      },

      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Inter',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },

      boxShadow: {
        // Neumorphic dual shadow (raised)
        card:  '6px 6px 12px #C8D0D9, -6px -6px 12px #FFFFFF',
        glass: '6px 6px 12px #C8D0D9, -6px -6px 12px #FFFFFF',
        // Inset (pressed / input)
        inset: 'inset 2px 2px 5px #C8D0D9, inset -2px -2px 5px #FFFFFF',
      },

      backdropBlur: {
        xl: '24px',
      },

      transitionTimingFunction: {
        ios: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },

      spacing: {
        'safe-top':    'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
};
