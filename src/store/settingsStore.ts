import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { ShopSettings } from '@/types'

interface SettingsState {
  settings: ShopSettings | null
  loading: boolean
  fetchSettings: () => Promise<void>
  updateSettings: (updates: Partial<ShopSettings>) => Promise<void>
}

const DEFAULT_SETTINGS: Omit<ShopSettings, 'id' | 'updated_at'> = {
  shop_name: 'Smart Cashback Shop',
  shop_address: '',
  contact_number: '',
  cashback_percentage: 2,
  minimum_eligible_purchase: 99,
  currency: 'INR',
  date_format: 'DD/MM/YYYY',
  time_format: '12h',
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  loading: false,

  fetchSettings: async () => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('shop_settings')
      .select('*')
      .limit(1)
      .single()

    if (error || !data) {
      // Return defaults if no settings row yet
      set({
        settings: {
          id: '',
          updated_at: new Date().toISOString(),
          ...DEFAULT_SETTINGS,
        } as ShopSettings,
        loading: false,
      })
    } else {
      set({ settings: data as ShopSettings, loading: false })
    }
  },

  updateSettings: async (updates) => {
    const current = get().settings
    if (!current) return

    const { data, error } = await supabase
      .from('shop_settings')
      .upsert({ ...current, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single()

    if (!error && data) {
      set({ settings: data as ShopSettings })
    }
  },
}))
