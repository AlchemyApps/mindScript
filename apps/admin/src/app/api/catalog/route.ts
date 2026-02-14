import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema for creating/updating a track
const TrackSchema = z.object({
  title: z.string().min(1).max(255),
  artist: z.string().optional(),
  url: z.string().url(),
  price_cents: z.number().int().min(0),
  duration_seconds: z.number().int().positive().optional(),
  is_platform_asset: z.boolean().default(true),
  is_stereo: z.boolean().default(true),
  license_note: z.string().optional(),
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
  mood: z.string().optional(),
  genre: z.string().optional(),
  bpm: z.number().int().min(40).max(300).optional(),
  key_signature: z.string().optional(),
  file_size_bytes: z.number().int().positive().optional(),
  file_format: z.string().optional(),
  metadata: z.record(z.any()).default({}),
})

// GET /api/catalog - List all tracks with optional filters
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Check admin auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams
    const category = searchParams.get('category')
    const mood = searchParams.get('mood')
    const isActive = searchParams.get('is_active')
    const isPlatform = searchParams.get('is_platform')
    const search = searchParams.get('search')
    const tag = searchParams.get('tag')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('background_tracks')
      .select(`
        *,
        track_licensing (
          id,
          license_type,
          license_provider,
          expiry_date,
          territory,
          attribution_required
        )
      `, { count: 'exact' })

    // Apply filters
    if (category) query = query.eq('category', category)
    if (mood) query = query.eq('mood', mood)
    if (isActive !== null) query = query.eq('is_active', isActive === 'true')
    if (isPlatform !== null) query = query.eq('is_platform_asset', isPlatform === 'true')
    if (tag) {
      query = query.contains('tags', [tag])
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,artist.ilike.%${search}%`)
    }

    // Apply pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: tracks, error, count } = await query

    if (error) throw error

    // Get usage stats
    const { data: stats } = await supabase
      .from('track_usage_stats')
      .select('*')

    return NextResponse.json({
      tracks,
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching catalog:', error)
    return NextResponse.json(
      { error: 'Failed to fetch catalog' },
      { status: 500 }
    )
  }
}

// POST /api/catalog - Create a new track
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Check admin auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse and validate request body
    const body = await req.json()
    const validatedData = TrackSchema.parse(body)

    // Create track
    const { data: track, error } = await supabase
      .from('background_tracks')
      .insert({
        ...validatedData,
        created_by: user.id
      })
      .select()
      .single()

    if (error) throw error

    // If licensing info provided, create licensing record
    if (body.licensing) {
      const { error: licenseError } = await supabase
        .from('track_licensing')
        .insert({
          track_id: track.id,
          ...body.licensing
        })

      if (licenseError) {
        console.error('Error creating licensing:', licenseError)
      }
    }

    return NextResponse.json({ track }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating track:', error)
    return NextResponse.json(
      { error: 'Failed to create track' },
      { status: 500 }
    )
  }
}

// PATCH /api/catalog - Update a track
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Check admin auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const body = await req.json()
    const { id, licensing, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      )
    }

    // Update track
    const { data: track, error } = await supabase
      .from('background_tracks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Update licensing if provided
    if (licensing) {
      // Check if licensing record exists
      const { data: existingLicense } = await supabase
        .from('track_licensing')
        .select('id')
        .eq('track_id', id)
        .single()

      if (existingLicense) {
        // Update existing
        await supabase
          .from('track_licensing')
          .update(licensing)
          .eq('track_id', id)
      } else {
        // Create new
        await supabase
          .from('track_licensing')
          .insert({
            track_id: id,
            ...licensing
          })
      }
    }

    return NextResponse.json({ track })
  } catch (error) {
    console.error('Error updating track:', error)
    return NextResponse.json(
      { error: 'Failed to update track' },
      { status: 500 }
    )
  }
}

// DELETE /api/catalog - Delete a track
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Check admin auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get track ID from query params
    const searchParams = req.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Track ID is required' },
        { status: 400 }
      )
    }

    // Delete track (licensing will cascade delete)
    const { error } = await supabase
      .from('background_tracks')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting track:', error)
    return NextResponse.json(
      { error: 'Failed to delete track' },
      { status: 500 }
    )
  }
}
