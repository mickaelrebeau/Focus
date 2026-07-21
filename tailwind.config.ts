import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/components/**/*.{js,vue,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './app/app.vue',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Open Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        focus: {
          black: '#000000',
          white: '#ffffff',
          gray: {
            50: '#fafafa',
            100: '#f5f5f7',
            200: '#e8e8ed',
            300: '#d2d2d7',
            400: '#86868b',
            500: '#6e6e73',
            600: '#424245',
            700: '#1d1d1f',
            800: '#111111',
            900: '#000000',
          },
          accent: '#0071e3',
        },
        'app-canvas': '#F5F7FC',
        'app-surface': '#FFFFFF',
        'app-ink': '#111827',
        'app-blue': '#315CFF',
        'app-mist': '#EEF1FF',
        'app-muted': '#AAB8FF',
        'app-line': '#E4E9F4',
        'app-secondary': '#667085',
      },
      borderRadius: {
        focus: '12px',
        'focus-lg': '18px',
        'focus-xl': '24px',
        'app-card': '26px',
        'app-control': '16px',
      },
      boxShadow: {
        focus: '0 4px 24px rgba(0, 0, 0, 0.06)',
        'focus-lg': '0 8px 40px rgba(0, 0, 0, 0.08)',
        'app-soft': '0 10px 35px rgba(30, 55, 115, 0.07)',
        'app-nav': '0 12px 36px rgba(30, 55, 115, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.82)',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-out-left': 'slideOutLeft 0.24s ease-in',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
