import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: ThemeMode
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: ThemeMode) => void
  initialize: () => void
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: ThemeMode) {
  if (typeof window === 'undefined') return

  const resolved = theme === 'system' ? getSystemTheme() : theme
  const root = document.documentElement

  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  // Update meta color-scheme
  let meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'color-scheme'
    document.head.appendChild(meta)
  }
  meta.content = theme === 'system' ? 'light dark' : theme
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'system',
  resolvedTheme: 'light',

  initialize: () => {
    if (typeof window === 'undefined') return

    const saved = localStorage.getItem('theme-preference') as ThemeMode | null
    const initialTheme: ThemeMode = (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system'
    const resolved = initialTheme === 'system' ? getSystemTheme() : initialTheme

    applyTheme(initialTheme)
    set({ theme: initialTheme, resolvedTheme: resolved })

    // Listen to OS preference changes
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const current = get().theme
      if (current === 'system') {
        const newResolved = getSystemTheme()
        applyTheme('system')
        set({ resolvedTheme: newResolved })
      }
    }

    try {
      media.addEventListener('change', handleChange)
    } catch {
      media.addListener(handleChange)
    }
  },

  setTheme: (newTheme: ThemeMode) => {
    try {
      localStorage.setItem('theme-preference', newTheme)
    } catch {
      // Ignore if localStorage unavailable
    }
    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme
    applyTheme(newTheme)
    set({ theme: newTheme, resolvedTheme: resolved })
  },
}))
