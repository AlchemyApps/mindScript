import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function PATCH(
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

    // Update feature flag
    const { data: updatedFeature, error } = await supabase
      .from('feature_flags')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update feature flag:', error)
      return NextResponse.json({ error: 'Failed to update feature' }, { status: 500 })
    }

    return NextResponse.json(updatedFeature)
  } catch (error) {
    console.error('Error in PATCH /api/pricing/features/[id]:', error)
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

    // Delete feature flag
    const { error } = await supabase
      .from('feature_flags')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Failed to delete feature flag:', error)
      return NextResponse.json({ error: 'Failed to delete feature' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/pricing/features/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}