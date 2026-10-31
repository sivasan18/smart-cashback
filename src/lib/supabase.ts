import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://lpmdrmkjzbausqkakbge.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwbWRybWtqemJhdXNxa2FrYmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTg5MDUsImV4cCI6MjEwODk3NDkwNX0.-D4iVGH7BnCj44sItaxeR9R-GuHKjtmeqhz7h416c_s'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || DEFAULT_SUPABASE_URL
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_SUPABASE_ANON_KEY

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.info('ℹ️ Using embedded Supabase configuration for production deployment.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export default supabase
