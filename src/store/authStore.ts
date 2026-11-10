import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

export interface UserProfile {
  role: string
  shop_id: string
  shop_name: string
  email: string
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  initialized: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

// Safely extract profile details with fault-tolerant fallbacks
function extractProfile(user: User | null): UserProfile {
  if (!user) {
    return {
      role: 'admin',
      shop_id: '01',
      shop_name: 'Main Branch #01',
      email: '',
    }
  }

  const meta = user.user_metadata || {}
  return {
    role: meta.role || 'admin',
    shop_id: meta.shop_id || '01',
    shop_name: meta.shop_name || 'Main Branch #01',
    email: user.email || '',
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  profile: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    try {
      // 1. Fetch current session with timeout safeguard
      const sessionPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise<{ data: { session: null }; error: null }>((resolve) =>
        setTimeout(() => resolve({ data: { session: null }, error: null }), 3000)
      )

      const result = await Promise.race([sessionPromise, timeoutPromise])
      const session = result?.data?.session ?? null
      const user = session?.user ?? null

      set({
        session,
        user,
        profile: extractProfile(user),
        initialized: true,
      })
    } catch (err) {
      console.warn('[AuthStore] Supabase getSession encountered error, using local fallback:', err)
      set({
        session: null,
        user: null,
        profile: null,
        initialized: true,
      })
    }

    // 2. Realtime auth listener to handle token refreshes, login and logout seamlessly
    try {
      supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user ?? null
        set({
          session,
          user,
          profile: extractProfile(user),
          initialized: true,
        })
      })
    } catch (listenerErr) {
      console.warn('[AuthStore] onAuthStateChange setup failed:', listenerErr)
    }
  },

  signIn: async (email, password) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      set({ loading: false })

      if (error) {
        return { error: error.message }
      }

      const user = data.user
      set({
        session: data.session,
        user,
        profile: extractProfile(user),
        initialized: true,
      })
      return { error: null }
    } catch (err: unknown) {
      set({ loading: false })
      const message = err instanceof Error ? err.message : 'Authentication service error'
      return { error: message }
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('[AuthStore] Sign out error:', err)
    } finally {
      set({ session: null, user: null, profile: null })
    }
  },
}))
