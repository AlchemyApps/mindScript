import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const querySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  limit: z
    .preprocess((val) => (val ? Number(val) : 50), z.number().int().min(1).max(100))
    .default(50),
})

const ensureAdmin = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return { supabase, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { supabase, user }
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, error } = await ensureAdmin()
    if (error) return error

    const searchParams = req.nextUrl.searchParams
    const { status, category, limit } = querySchema.parse({
      status: searchParams.get('status') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

    let query = supabase
      .from('content_reports')
      .select(
        `
          id,
          content_type,
          content_id,
          category,
          description,
          status,
          priority_score,
          created_at,
          reporter_id,
          reporter:profiles!reporter_id (
            id,
            email,
            display_name,
            username
          )
        `
      )
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    const { data: reports, error: reportsError } = await query
    if (reportsError) {
      console.error('Failed to fetch moderation queue:', reportsError)
      return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
    }

    const uniquePairs = Array.from(
      new Set((reports || []).map((report) => `${report.content_type}::${report.content_id}`))
    ).map((key) => {
      const [content_type, content_id] = key.split('::')
      return { content_type, content_id }
    })

    const counts = new Map<string, number>()
    await Promise.all(
      uniquePairs.map(async ({ content_type, content_id }) => {
        const { count, error: countError } = await supabase
          .from('content_reports')
          .select('*', { count: 'exact', head: true })
          .eq('content_type', content_type)
          .eq('content_id', content_id)

        if (countError) {
          console.error('Failed to count similar reports:', countError)
          counts.set(`${content_type}::${content_id}`, 1)
          return
        }

        counts.set(`${content_type}::${content_id}`, count ?? 1)
      })
    )

    const response = (reports || []).map((report) => ({
      ...report,
      similar_reports_count: counts.get(`${report.content_type}::${report.content_id}`) ?? 1,
    }))

    return NextResponse.json({ reports: response })
  } catch (err) {
    console.error('Unexpected error in GET /api/moderation/queue:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
