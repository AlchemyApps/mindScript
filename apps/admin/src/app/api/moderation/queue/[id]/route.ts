import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  action: z.enum(['approve', 'dismiss']),
  notes: z.string().optional(),
})

async function getAdminClient() {
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

  return { supabase, user }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, user, error } = await getAdminClient()
    if (error || !user) return error

    const json = await req.json()
    const { action, notes } = bodySchema.parse(json)
    const newStatus = action === 'approve' ? 'actioned' : 'dismissed'

    const { error: updateError } = await supabase
      .from('content_reports')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        review_notes: notes || (action === 'approve' ? 'Actioned by admin' : 'Dismissed by admin'),
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('Failed to update content report:', updateError)
      return NextResponse.json({ error: 'Failed to update report' }, { status: 500 })
    }

    // Update reporter credibility but ignore failures so moderation still completes
    try {
      await supabase.rpc('update_reporter_credibility', {
        p_report_id: params.id,
        p_was_accurate: action === 'approve',
      })
    } catch (rpcError) {
      console.error('Reporter credibility update failed:', rpcError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Unexpected error in PATCH /api/moderation/queue/[id]:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
