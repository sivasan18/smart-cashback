/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        obsidian: {
          950: '#06080d',
          900: '#0b0f17',
          850: '#111726',
          800: '#172033',
        },
        brand: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24', // Gold
          500: '#f59e0b', // Amber primary
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        gold: {
          light: '#fef08a',
          DEFAULT: '#fbbf24',
          dark: '#d97706',
        },
        dark: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          850: '#111726',
          900: '#0b0f17',
          950: '#06080d',
        }
      },
      boxShadow: {
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
        'card-hover': '0 12px 30px -4px rgba(0, 0, 0, 0.6)',
        'card-dark': '0 8px 30px -4px rgba(0, 0, 0, 0.7)',
        'glow-amber': '0 0 25px -2px rgba(245, 158, 11, 0.35)',
        'glow-gold': '0 0 35px -5px rgba(251, 191, 36, 0.4)',
      },
    },
  },
  plugins: [],
}
