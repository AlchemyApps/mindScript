import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({
        authenticated: false,
        error: authError?.message || 'No user found',
        user: null,
        profile: null,
        debug: {
          auth_error: authError,
        }
      })
    }

    // Try to get profile data
    let profile = null
    let profileError = null
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, account_status, created_at')
        .eq('id', user.id)
        .single()

      profile = data
      profileError = error
    } catch (e) {
      profileError = e
    }

    // Return comprehensive debug info
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        app_metadata: user.app_metadata,
        user_metadata: user.user_metadata,
      },
      profile: profile,
      roles: {
        profile_role: profile?.role || null,
        app_metadata_role: user.app_metadata?.role || null,
        user_metadata_role: user.user_metadata?.role || null,
      },
      checks: {
        has_profile: !!profile,
        profile_is_active: profile?.account_status === 'active',
        is_admin: profile?.role === 'admin' || profile?.role === 'super_admin',
        is_super_admin: profile?.role === 'super_admin',
      },
      debug: {
        profile_error: profileError,
        auth_provider: user.app_metadata?.provider,
        auth_providers: user.app_metadata?.providers,
      }
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      }
    })
  } catch (error) {
    console.error('Whoami error:', error)
    return NextResponse.json({
      authenticated: false,
      error: 'Internal server error',
      debug: { error: String(error) }
    }, { status: 500 })
  }
}