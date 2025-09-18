import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const body = await request.json()

    // Update tier
    const { data: updatedTier, error } = await supabase
      .from('pricing_tiers')
      .update({
        ...body,
        features: JSON.stringify(body.features || [])
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update pricing tier:', error)
      return NextResponse.json({ error: 'Failed to update tier' }, { status: 500 })
    }

    return NextResponse.json(updatedTier)
  } catch (error) {
    console.error('Error in PUT /api/pricing/tiers/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check if there are active subscriptions
    const { data: subscriptions } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('tier_id', params.id)
      .eq('status', 'active')
      .limit(1)

    if (subscriptions && subscriptions.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete tier with active subscriptions' },
        { status: 400 }
      )
    }

    // Delete tier
    const { error } = await supabase
      .from('pricing_tiers')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Failed to delete pricing tier:', error)
      return NextResponse.json({ error: 'Failed to delete tier' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/pricing/tiers/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}