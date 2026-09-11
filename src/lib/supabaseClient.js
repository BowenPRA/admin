import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

// When the env vars are missing the app falls back to browser storage
// (see db.js), so it can be tried without any setup.
export const hasSupabase = Boolean(url && key)

export const supabase = hasSupabase ? createClient(url, key) : null
