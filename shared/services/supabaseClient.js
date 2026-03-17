import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SUPABASE_CONFIG } from './config.js'

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: localStorage,
    storageKey: 'docuflow_session'
  }
})

export { SUPABASE_CONFIG }