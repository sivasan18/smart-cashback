import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  initialized: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    const { data } = await supabase.auth.getSession()
    set({
      session: data.session,
      user: data.session?.user ?? null,
      initialized: true,
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null })
    })
  },

  signIn: async (email, password) => {
    set({ loading: true })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    set({ loading: false })

    if (error) return { error: error.message }
    set({ session: data.session, user: data.user })
    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null })
  },
}))
