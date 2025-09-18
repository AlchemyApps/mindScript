import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET() {
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

    // Fetch pricing tiers with subscriber counts
    const { data: tiers, error } = await supabase
      .from('pricing_dashboard')
      .select('*')
      .order('position')

    if (error) {
      console.error('Failed to fetch pricing tiers:', error)
      return NextResponse.json({ error: 'Failed to fetch tiers' }, { status: 500 })
    }

    return NextResponse.json(tiers || [])
  } catch (error) {
    console.error('Error in GET /api/pricing/tiers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

    const body = await request.json()

    // Get the highest position
    const { data: lastTier } = await supabase
      .from('pricing_tiers')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const newPosition = (lastTier?.position ?? -1) + 1

    // Insert new tier
    const { data: newTier, error } = await supabase
      .from('pricing_tiers')
      .insert({
        ...body,
        position: newPosition,
        features: JSON.stringify(body.features || [])
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create pricing tier:', error)
      return NextResponse.json({ error: 'Failed to create tier' }, { status: 500 })
    }

    return NextResponse.json(newTier)
  } catch (error) {
    console.error('Error in POST /api/pricing/tiers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}