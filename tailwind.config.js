/** @type {import('tailwindcss').Config} */
const amber = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FCD34D',
  400: '#FBBF24',
  500: '#F59E0B',
  600: '#D97706',
  700: '#B45309',
  800: '#92400E',
  900: '#78350F',
  950: '#451A03',
}

const slate = {
  50: '#E2E8F0',
  100: '#CBD5E1',
  200: '#94A3B8',
  300: '#64748B',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#1E2638',
  800: '#1E2638',
  850: '#172033',
  900: '#0D1117',
  950: '#08090D',
}

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        brand: {
          ...amber,
        },
        raspberry: '#F59E0B',
        palesky: '#FEF3C7',
        dark: {
          ...slate,
        },
        cyan: amber,
        teal: amber,
        emerald: amber,
        green: amber,
        violet: amber,
        purple: amber,
        indigo: amber,
        blue: amber,
        sky: amber,
        lime: amber,
        pink: amber,
        fuchsia: amber,
        orange: amber,
        yellow: amber,
        rose: slate,
        red: slate,
        gray: slate,
        zinc: slate,
        neutral: slate,
        stone: slate,
        slate,
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card-hover': '0 8px 26px -8px rgb(245 158 11 / 0.12), 0 2px 8px -2px rgb(0 0 0 / 0.4)',
        'card-dark': '0 8px 28px -8px rgb(0 0 0 / 0.55)',
        'glow-brand': '0 0 24px -2px rgba(245, 158, 11, 0.35)',
      },
    },
  },
  plugins: [],
}
