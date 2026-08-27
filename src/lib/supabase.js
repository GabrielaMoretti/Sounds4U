import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseAnonKey !== 'your-anon-key'
)

if (!isSupabaseConfigured) {
  console.warn(
    '[sounds4u] Supabase não configurado — copie .env.example para .env e preencha ' +
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (projeto novo, conta separada do STRM Insight). ' +
      'Reviews e amigos usam localStorage como placeholder até lá.'
  )
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
