import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates = await request.json()

    // Update all positions in a transaction-like manner
    for (const update of updates) {
      const { error } = await supabase
        .from('pricing_tiers')
        .update({ position: update.position })
        .eq('id', update.id)

      if (error) {
        console.error('Failed to update tier position:', error)
        return NextResponse.json({ error: 'Failed to reorder tiers' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in POST /api/pricing/tiers/reorder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}