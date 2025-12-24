import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function ensureAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return { supabase, user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { supabase, user }
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, error } = await ensureAdmin()
    if (error) return error

    const params = request.nextUrl.searchParams
    const limit = Math.min(Number(params.get('limit') ?? 50), 200)
    const actionFilter = params.get('action')
    const adminId = params.get('adminId')
    const start = params.get('start')
    const end = params.get('end')

    let query = supabase
      .from('admin_activity_log')
      .select('id, admin_id, action, entity_type, entity_id, ip_address, user_agent, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (actionFilter) {
      query = query.ilike('action', `%${actionFilter}%`)
    }

    if (adminId) {
      query = query.eq('admin_id', adminId)
    }

    if (start) {
      query = query.gte('created_at', start)
    }

    if (end) {
      query = query.lte('created_at', end)
    }

    const { data: logs, error: logsError } = await query

    if (logsError || !logs) {
      console.error('Failed to fetch admin activity logs:', logsError)
      return NextResponse.json({ error: 'Failed to fetch activity log' }, { status: 500 })
    }

    const adminIds = Array.from(new Set(logs.map((log) => log.admin_id)))
    const adminMap = new Map<
      string,
      {
        id: string
        full_name: string | null
        email: string | null
      }
    >()

    if (adminIds.length) {
      const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', adminIds)

      if (adminsError) {
        console.error('Failed to fetch admin profiles:', adminsError)
      } else {
        for (const admin of admins || []) {
          adminMap.set(admin.id, {
            id: admin.id,
            full_name: admin.full_name ?? null,
            email: admin.email ?? null,
          })
        }
      }
    }

    const payload = logs.map((log) => ({
      ...log,
      admin: adminMap.get(log.admin_id) ?? null,
    }))

    return NextResponse.json({ logs: payload })
  } catch (err) {
    console.error('Unexpected error in GET /api/admin/activity:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
