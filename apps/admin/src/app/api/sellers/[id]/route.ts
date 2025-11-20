import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const updateSchema = z
  .object({
    status: z
      .enum(['pending_onboarding', 'onboarding_incomplete', 'active', 'suspended', 'rejected'])
      .optional(),
    charges_enabled: z.boolean().optional(),
    payouts_enabled: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'No fields provided',
  })

async function ensureAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return { supabase, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { supabase }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, error } = await ensureAdmin()
    if (error) return error

    const json = await req.json()
    const payload = updateSchema.parse(json)

    const { error: updateError } = await supabase
      .from('seller_agreements')
      .update(payload)
      .eq('id', params.id)

    if (updateError) {
      console.error('Failed to update seller agreement:', updateError)
      return NextResponse.json({ error: 'Failed to update seller' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', details: err.issues }, { status: 400 })
    }

    console.error('Unexpected error in PATCH /api/sellers/[id]:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
