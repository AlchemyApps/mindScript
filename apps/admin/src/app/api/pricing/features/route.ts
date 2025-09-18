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

    // Fetch feature flags
    const { data: features, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('name')

    if (error) {
      console.error('Failed to fetch feature flags:', error)
      return NextResponse.json({ error: 'Failed to fetch features' }, { status: 500 })
    }

    return NextResponse.json(features || [])
  } catch (error) {
    console.error('Error in GET /api/pricing/features:', error)
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

    // Insert new feature flag
    const { data: newFeature, error } = await supabase
      .from('feature_flags')
      .insert(body)
      .select()
      .single()

    if (error) {
      console.error('Failed to create feature flag:', error)
      return NextResponse.json({ error: 'Failed to create feature' }, { status: 500 })
    }

    return NextResponse.json(newFeature)
  } catch (error) {
    console.error('Error in POST /api/pricing/features:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}