import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { subDays, format } from 'date-fns'

async function getAdminClient() {
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

  return { supabase }
}

export async function GET() {
  try {
    const { supabase, error } = await getAdminClient()
    if (error) return error

    const now = new Date()
    const sevenDaysAgo = subDays(now, 7).toISOString()

    const [
      { data: recentReports, error: recentError },
      { data: weeklyReports, error: weeklyError },
      { data: topReporters, error: reportersError },
    ] = await Promise.all([
      supabase
        .from('content_reports')
        .select('category')
        .gte('created_at', sevenDaysAgo),

      supabase
        .from('content_reports')
        .select('created_at,status')
        .gte('created_at', sevenDaysAgo),

      supabase
        .from('reporter_credibility')
        .select(
          `
            user_id,
            total_reports,
            accurate_reports,
            credibility_score,
            profiles!user_id (
              username
            )
          `
        )
        .order('total_reports', { ascending: false })
        .limit(5),
    ])

    if (recentError || weeklyError || reportersError) {
      console.error('Failed to fetch moderation metrics', {
        recentError,
        weeklyError,
        reportersError,
      })
      return NextResponse.json({ error: 'Failed to load metrics' }, { status: 500 })
    }

    const statuses = [
      'pending',
      'under_review',
      'actioned',
      'dismissed',
      'auto_dismissed',
    ] as const

    const statusCounts = await Promise.all(
      statuses.map(async (status) => {
        const { count } = await supabase
          .from('content_reports')
          .select('*', { count: 'exact', head: true })
          .eq('status', status)
        return { status, count: count || 0 }
      })
    )

    const statusMap = statusCounts.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item.count
      return acc
    }, {})

    const totalReports = statusCounts.reduce((sum, item) => sum + item.count, 0)
    const falsePositiveRate =
      totalReports === 0
        ? 0
        : (((statusMap.dismissed || 0) + (statusMap.auto_dismissed || 0)) / totalReports) * 100

    const categoryCount: Record<string, number> = {}
    recentReports?.forEach((report) => {
      if (!report.category) return
      categoryCount[report.category] = (categoryCount[report.category] || 0) + 1
    })

    const dailyData: Record<string, { reports: number; actions: number }> = {}
    for (let i = 0; i < 7; i++) {
      const dateLabel = format(subDays(now, i), 'MMM d')
      dailyData[dateLabel] = { reports: 0, actions: 0 }
    }

    weeklyReports?.forEach((report) => {
      const dateLabel = format(new Date(report.created_at), 'MMM d')
      if (!dailyData[dateLabel]) return
      dailyData[dateLabel].reports++
      if (report.status === 'actioned') {
        dailyData[dateLabel].actions++
      }
    })

    return NextResponse.json({
      totalReports,
      pendingReports: statusMap.pending || 0,
      actionedReports: statusMap.actioned || 0,
      dismissedReports: (statusMap.dismissed || 0) + (statusMap.auto_dismissed || 0),
      averageResponseTime: 0,
      falsePositiveRate,
      reportsByCategory: Object.entries(categoryCount).map(([category, count]) => ({
        category,
        count,
      })),
      weeklyTrend: Object.entries(dailyData)
        .reverse()
        .map(([date, value]) => ({ date, ...value })),
      topReporters:
        topReporters?.map((reporter) => ({
          username: reporter.profiles?.username || 'unknown',
          reports: reporter.total_reports,
          accuracy: (reporter.credibility_score || 0) * 100,
        })) || [],
    })
  } catch (err) {
    console.error('Unexpected error fetching moderation metrics:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
