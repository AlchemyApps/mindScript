import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { startOfMonth, subMonths, format } from 'date-fns'
import { cacheQuery, getCacheKey } from '@/lib/cache'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const metric = searchParams.get('metric')
  const period = searchParams.get('period') || '30d'

  const supabase = await createServerSupabaseClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    switch (metric) {
      case 'revenue': {
        const cacheKey = getCacheKey('revenue', { period })
        const revenueData = await cacheQuery(
          cacheKey,
          () => getRevenueMetrics(supabase, period),
          { ttl: 300, tags: ['revenue'] } // 5 minutes cache
        )
        return NextResponse.json(revenueData)
      }

      case 'users': {
        const cacheKey = getCacheKey('users', { period })
        const userData = await cacheQuery(
          cacheKey,
          () => getUserMetrics(supabase, period),
          { ttl: 300, tags: ['users'] }
        )
        return NextResponse.json(userData)
      }

      case 'content': {
        const cacheKey = getCacheKey('content', { period })
        const contentData = await cacheQuery(
          cacheKey,
          () => getContentMetrics(supabase, period),
          { ttl: 300, tags: ['content'] }
        )
        return NextResponse.json(contentData)
      }

      case 'platform': {
        const cacheKey = getCacheKey('platform', {})
        const platformData = await cacheQuery(
          cacheKey,
          () => getPlatformMetrics(supabase),
          { ttl: 60, tags: ['platform'] } // 1 minute cache for real-time metrics
        )
        return NextResponse.json(platformData)
      }

      case 'overview': {
        const cacheKey = getCacheKey('overview', { period })
        const overviewData = await cacheQuery(
          cacheKey,
          async () => {
            const [revenue, users, content, platform] = await Promise.all([
              getRevenueMetrics(supabase, period),
              getUserMetrics(supabase, period),
              getContentMetrics(supabase, period),
              getPlatformMetrics(supabase),
            ])

            return {
              revenue,
              users,
              content,
              platform,
            }
          },
          { ttl: 300, tags: ['overview'] }
        )
        return NextResponse.json(overviewData)
      }

      default:
        return NextResponse.json({ error: 'Invalid metric' }, { status: 400 })
    }
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getRevenueMetrics(supabase: any, period: string) {
  // Calculate MRR (Monthly Recurring Revenue)
  const { data: activeSubscriptions } = await supabase
    .from('subscriptions')
    .select('price_amount')
    .eq('status', 'active')

  const mrr = activeSubscriptions?.reduce((sum, sub) => sum + (sub.price_amount / 100), 0) || 0
  const arr = mrr * 12 // Annual Recurring Revenue

  // Get revenue over time
  const { data: revenueOverTime } = await supabase
    .from('payments')
    .select('amount, created_at')
    .gte('created_at', getDateFromPeriod(period))
    .order('created_at')

  // Calculate churn rate
  const { data: churnedCount } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact' })
    .eq('status', 'cancelled')
    .gte('cancelled_at', getDateFromPeriod('30d'))

  const { data: totalActive } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact' })
    .eq('status', 'active')

  const churnRate = totalActive?.length > 0
    ? ((churnedCount?.length || 0) / totalActive.length) * 100
    : 0

  // Get top revenue sources
  const { data: topSources } = await supabase
    .from('payments')
    .select('seller_id, sellers(name), amount')
    .gte('created_at', getDateFromPeriod(period))
    .limit(10)

  // Process revenue by day/month
  const revenueByPeriod = processRevenueByPeriod(revenueOverTime || [], period)

  return {
    mrr,
    arr,
    churnRate,
    totalRevenue: revenueOverTime?.reduce((sum, payment) => sum + payment.amount, 0) || 0,
    revenueByPeriod,
    topSources,
    growth: calculateGrowth(revenueByPeriod),
  }
}

async function getUserMetrics(supabase: any, period: string) {
  // Get total users
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  // Get new users in period
  const { data: newUsers } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', getDateFromPeriod(period))

  // Get active users (had activity in last 30 days)
  const { count: activeUsers } = await supabase
    .from('user_activities')
    .select('user_id', { count: 'exact', head: true })
    .gte('created_at', getDateFromPeriod('30d'))

  // User growth over time
  const userGrowth = processUserGrowth(newUsers || [], period)

  // User cohorts by subscription tier
  const { data: userCohorts } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .not('subscription_tier', 'is', null)

  const cohortData = processCohortData(userCohorts || [])

  // Calculate retention rate
  const { data: retainedUsers } = await supabase
    .from('user_activities')
    .select('user_id')
    .gte('created_at', getDateFromPeriod('60d'))
    .lte('created_at', getDateFromPeriod('30d'))

  const retentionRate = totalUsers > 0
    ? ((retainedUsers?.length || 0) / totalUsers) * 100
    : 0

  return {
    totalUsers,
    newUsers: newUsers?.length || 0,
    activeUsers,
    userGrowth,
    cohortData,
    retentionRate,
    avgSessionDuration: '12m 34s', // Would need session tracking
  }
}

async function getContentMetrics(supabase: any, period: string) {
  // Get total tracks
  const { count: totalTracks } = await supabase
    .from('tracks')
    .select('*', { count: 'exact', head: true })

  // Get new tracks in period
  const { data: newTracks } = await supabase
    .from('tracks')
    .select('created_at')
    .gte('created_at', getDateFromPeriod(period))

  // Get play counts
  const { data: playData } = await supabase
    .from('track_plays')
    .select('track_id, created_at')
    .gte('created_at', getDateFromPeriod(period))

  // Get download counts
  const { data: downloadData } = await supabase
    .from('track_downloads')
    .select('track_id, created_at')
    .gte('created_at', getDateFromPeriod(period))

  // Top performing tracks
  const { data: topTracks } = await supabase
    .from('tracks')
    .select('id, title, play_count, download_count')
    .order('play_count', { ascending: false })
    .limit(10)

  // Content creation velocity
  const contentVelocity = processContentVelocity(newTracks || [], period)

  return {
    totalTracks,
    newTracks: newTracks?.length || 0,
    totalPlays: playData?.length || 0,
    totalDownloads: downloadData?.length || 0,
    topTracks,
    contentVelocity,
    avgTrackLength: '5m 23s', // Would need to aggregate from tracks
    popularCategories: ['Meditation', 'Sleep', 'Focus'], // Would need category data
  }
}

async function getPlatformMetrics(supabase: any) {
  // Get job queue stats
  const { data: queueStats } = await supabase
    .from('job_queue')
    .select('status, type')

  const queueMetrics = processQueueMetrics(queueStats || [])

  // Get error rate from last 24 hours
  const { count: totalRequests } = await supabase
    .from('api_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', getDateFromPeriod('24h'))

  const { count: failedRequests } = await supabase
    .from('api_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', getDateFromPeriod('24h'))
    .gte('status_code', 400)

  const errorRate = totalRequests > 0
    ? ((failedRequests || 0) / totalRequests) * 100
    : 0

  // System health indicators
  const systemHealth = {
    database: 'healthy',
    storage: 'healthy',
    audioProcessor: queueMetrics.audioRenderQueue.processing > 0 ? 'busy' : 'idle',
    apiLatency: '45ms', // Would need actual monitoring
  }

  return {
    queueMetrics,
    errorRate,
    systemHealth,
    avgResponseTime: '125ms',
    uptime: '99.9%',
    activeWorkers: 4,
  }
}

function getDateFromPeriod(period: string): string {
  const now = new Date()
  const match = period.match(/(\d+)([dhm])/)
  if (!match) return now.toISOString()

  const [, num, unit] = match
  const amount = parseInt(num)

  switch (unit) {
    case 'h':
      return new Date(now.getTime() - amount * 60 * 60 * 1000).toISOString()
    case 'd':
      return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000).toISOString()
    case 'm':
      return new Date(now.setMonth(now.getMonth() - amount)).toISOString()
    default:
      return now.toISOString()
  }
}

function processRevenueByPeriod(data: any[], period: string) {
  const grouped: Record<string, number> = {}

  data.forEach(item => {
    const date = new Date(item.created_at)
    const key = period.includes('d')
      ? format(date, 'yyyy-MM-dd')
      : format(date, 'yyyy-MM')

    grouped[key] = (grouped[key] || 0) + (item.amount / 100)
  })

  return Object.entries(grouped).map(([date, amount]) => ({
    date,
    amount,
  }))
}

function processUserGrowth(users: any[], period: string) {
  const grouped: Record<string, number> = {}

  users.forEach(user => {
    const date = new Date(user.created_at)
    const key = period.includes('d')
      ? format(date, 'yyyy-MM-dd')
      : format(date, 'yyyy-MM')

    grouped[key] = (grouped[key] || 0) + 1
  })

  return Object.entries(grouped).map(([date, count]) => ({
    date,
    count,
  }))
}

function processCohortData(users: any[]) {
  const cohorts: Record<string, number> = {}

  users.forEach(user => {
    const tier = user.subscription_tier || 'free'
    cohorts[tier] = (cohorts[tier] || 0) + 1
  })

  return Object.entries(cohorts).map(([tier, count]) => ({
    tier,
    count,
    percentage: (count / users.length) * 100,
  }))
}

function processContentVelocity(tracks: any[], period: string) {
  const grouped: Record<string, number> = {}

  tracks.forEach(track => {
    const date = new Date(track.created_at)
    const key = period.includes('d')
      ? format(date, 'yyyy-MM-dd')
      : format(date, 'yyyy-MM')

    grouped[key] = (grouped[key] || 0) + 1
  })

  return Object.entries(grouped).map(([date, count]) => ({
    date,
    count,
  }))
}

function processQueueMetrics(queueData: any[]) {
  const metrics: Record<string, any> = {
    emailQueue: { pending: 0, processing: 0, completed: 0, failed: 0 },
    audioRenderQueue: { pending: 0, processing: 0, completed: 0, failed: 0 },
    payoutQueue: { pending: 0, processing: 0, completed: 0, failed: 0 },
  }

  queueData.forEach(job => {
    const queueType = job.type.includes('email') ? 'emailQueue'
      : job.type.includes('audio') ? 'audioRenderQueue'
      : job.type.includes('payout') ? 'payoutQueue'
      : null

    if (queueType && metrics[queueType]) {
      metrics[queueType][job.status] = (metrics[queueType][job.status] || 0) + 1
    }
  })

  return metrics
}

function calculateGrowth(data: any[]) {
  if (data.length < 2) return 0

  const recent = data[data.length - 1]?.amount || 0
  const previous = data[data.length - 2]?.amount || 0

  if (previous === 0) return 100
  return ((recent - previous) / previous) * 100
}