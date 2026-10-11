import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// The site still renders (read-only) when the env vars are missing, e.g. a fresh clone.
export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null

export const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL || 'piyumalm912@gmail.com').toLowerCase()
