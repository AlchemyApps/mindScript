import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { serverSupabase } from '@/lib/supabase/server'

const updateSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required').max(50),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-z0-9\-_.]+$/i, 'Only letters, numbers, dashes, underscores, and periods are allowed'),
  bio: z.string().trim().max(500).optional().nullable(),
  avatarUrl: z.string().url('Invalid avatar URL').max(2048).optional().nullable(),
  businessName: z.string().trim().max(120).optional().nullable(),
})

export async function GET() {
  try {
    const supabase = await serverSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, display_name, bio, avatar_url')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { data: sellerProfile } = await supabase
      .from('seller_profiles')
      .select('business_name')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      profile: {
        username: profile.username || '',
        displayName: profile.display_name || '',
        bio: profile.bio || '',
        avatarUrl: profile.avatar_url || '',
        businessName: sellerProfile?.business_name || '',
      },
    })
  } catch (error) {
    console.error('Failed to load seller profile', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await serverSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await request.json()
    const parsed = updateSchema.parse(payload)

    const normalizedUsername = parsed.username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-_.]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '')

    if (normalizedUsername.length < 3) {
      return NextResponse.json(
        { error: 'Username must contain at least 3 alphanumeric characters' },
        { status: 400 }
      )
    }

    // Ensure username is unique
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle()

    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: 'Username is not available' }, { status: 409 })
    }

    const updates = [
      supabase
        .from('profiles')
        .update({
          username: normalizedUsername,
          display_name: parsed.displayName.trim(),
          bio: parsed.bio?.trim() || null,
          avatar_url: parsed.avatarUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id),
      supabase
        .from('seller_profiles')
        .upsert(
          {
            user_id: user.id,
            business_name: parsed.businessName?.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        ),
    ]

    const results = await Promise.all(updates)
    const error = results.find((result) => result.error)?.error

    if (error) {
      console.error('Failed to update seller profile:', error)
      return NextResponse.json({ error: error.message || 'Failed to update profile' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 })
    }

    console.error('Failed to update seller profile', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
