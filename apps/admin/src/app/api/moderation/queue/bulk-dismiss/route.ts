import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const payloadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
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

export async function POST(req: NextRequest) {
  try {
    const { supabase, user, error } = await getAdminClient()
    if (error || !user) return error

    const json = await req.json()
    const { ids } = payloadSchema.parse(json)

    const { error: updateError } = await supabase
      .from('content_reports')
      .update({
        status: 'dismissed',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        review_notes: 'Bulk dismissed by admin',
      })
      .in('id', ids)

    if (updateError) {
      console.error('Failed to bulk dismiss reports:', updateError)
      return NextResponse.json({ error: 'Failed to dismiss reports' }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: ids.length })
  } catch (err) {
    console.error('Unexpected error in POST /api/moderation/queue/bulk-dismiss:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
