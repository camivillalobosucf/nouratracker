import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

console.log('[noura] env check:', { supabaseUrl, supabaseAnonKey })

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
