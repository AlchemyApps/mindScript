import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data, error } = await supabase
      .from('voice_catalog')
      .select('id, internal_code, display_name, description, gender, tier, provider, provider_voice_id, preview_url, is_enabled, sort_order, price_cents')
      .order('tier')
      .order('sort_order')

    if (error) throw error

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Failed to fetch voices:', error)
    return NextResponse.json({ error: 'Failed to fetch voices' }, { status: 500 })
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
      return NextResponse.json({ error: 'Voice id is required' }, { status: 400 })
    }

    // Only allow updating specific fields
    const allowedFields = ['display_name', 'price_cents', 'tier', 'is_enabled', 'sort_order']
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
      .from('voice_catalog')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to update voice:', error)
    return NextResponse.json({ error: 'Failed to update voice' }, { status: 500 })
  }
}
