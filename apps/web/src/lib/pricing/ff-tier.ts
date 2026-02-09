import { createClient } from '@supabase/supabase-js'

export type FFTier = 'inner_circle' | 'cost_pass' | null

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * Look up a user's Friends & Family tier.
 * Returns null for normal users (no F&F membership).
 */
export async function getUserFFTier(userId: string): Promise<FFTier> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('ff_tier')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return (data.ff_tier as FFTier) ?? null
}
