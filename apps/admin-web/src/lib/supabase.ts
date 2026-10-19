import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

// Only the public publishable key belongs here. Admin access is enforced by RLS (public.is_admin()).
export const supabase = createClient(
  supabaseUrl || 'http://localhost',
  supabasePublishableKey || 'missing-key',
)

export function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') return err.message
  return fallback
}
