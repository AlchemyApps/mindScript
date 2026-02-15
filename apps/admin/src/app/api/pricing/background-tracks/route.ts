import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await supabase
      .from('background_tracks')
      .select('id, title, slug, category, bpm, key_signature, price_cents, duration_seconds, is_active, is_platform_asset, tier')
      .order('category')
      .order('title')

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Failed to fetch background tracks:', error)
    return NextResponse.json({ error: 'Failed to fetch background tracks' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Track id is required' }, { status: 400 })
    }

    const allowedFields = ['title', 'price_cents', 'is_active', 'category', 'tier']
    const safeUpdates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in updates) {
        safeUpdates[field] = updates[field]
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    safeUpdates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('background_tracks')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to update background track:', error)
    return NextResponse.json({ error: 'Failed to update background track' }, { status: 500 })
  }
}
