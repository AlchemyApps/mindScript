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

    // Fetch pricing configurations
    const { data: configs, error } = await supabase
      .from('pricing_configurations')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('key')

    if (error) {
      console.error('Failed to fetch pricing configurations:', error)
      return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 })
    }

    return NextResponse.json(configs || [])
  } catch (error) {
    console.error('Error in GET /api/pricing/configs:', error)
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

    // Insert new configuration
    const { data: newConfig, error } = await supabase
      .from('pricing_configurations')
      .insert(body)
      .select()
      .single()

    if (error) {
      console.error('Failed to create pricing configuration:', error)
      return NextResponse.json({ error: 'Failed to create config' }, { status: 500 })
    }

    return NextResponse.json(newConfig)
  } catch (error) {
    console.error('Error in POST /api/pricing/configs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}