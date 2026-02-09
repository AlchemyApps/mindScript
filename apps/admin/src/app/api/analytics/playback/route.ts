import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cacheQuery, getCacheKey } from '@/lib/cache'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '30d'

  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cacheKey = getCacheKey('analytics-playback', { period })
    const data = await cacheQuery(
      cacheKey,
      () => getPlaybackData(supabase, period),
      { ttl: 300, tags: ['analytics', 'playback'] }
    )
    return NextResponse.json(data)
  } catch (error) {
    console.error('Playback analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getPlaybackData(supabase: any, period: string) {
  const { startDate, endDate } = getDateRange(period)

  // Use the RPC function for platform stats
  const { data: platformStats, error: rpcError } = await supabase.rpc(
    'get_platform_listening_stats',
    { p_start: startDate, p_end: endDate }
  )

  if (rpcError) {
    console.error('RPC error:', rpcError)
  }

  // Get events over time for charting
  const { data: events } = await supabase
    .from('playback_events')
    .select('event_type, platform, created_at, duration_listened_seconds')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at')

  const eventList = events || []

  // Group plays over time
  const playsOverTime: Record<string, { date: string; plays: number; minutes: number }> = {}
  for (const event of eventList) {
    if (event.event_type !== 'play' && event.event_type !== 'resume') continue
    const date = new Date(event.created_at).toISOString().split('T')[0]
    if (!playsOverTime[date]) {
      playsOverTime[date] = { date, plays: 0, minutes: 0 }
    }
    playsOverTime[date].plays += 1
  }

  // Add listening minutes from pause/complete events (they carry duration_listened)
  for (const event of eventList) {
    if (event.event_type !== 'pause' && event.event_type !== 'complete') continue
    const date = new Date(event.created_at).toISOString().split('T')[0]
    if (!playsOverTime[date]) {
      playsOverTime[date] = { date, plays: 0, minutes: 0 }
    }
    playsOverTime[date].minutes += Math.round((event.duration_listened_seconds || 0) / 60)
  }

  const overTime = Object.values(playsOverTime).sort((a, b) => a.date.localeCompare(b.date))

  // Platform breakdown
  const platformBreakdown: Record<string, number> = {}
  for (const event of eventList) {
    if (event.event_type !== 'play') continue
    const p = event.platform || 'unknown'
    platformBreakdown[p] = (platformBreakdown[p] || 0) + 1
  }

  const byPlatform = Object.entries(platformBreakdown)
    .map(([platform, plays]) => ({ platform, plays }))
    .sort((a, b) => b.plays - a.plays)

  // Event type distribution
  const eventTypeBreakdown: Record<string, number> = {}
  for (const event of eventList) {
    eventTypeBreakdown[event.event_type] = (eventTypeBreakdown[event.event_type] || 0) + 1
  }

  const byEventType = Object.entries(eventTypeBreakdown)
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((a, b) => b.count - a.count)

  const stats = platformStats?.[0] || {}

  return {
    totalPlays: stats.total_plays || 0,
    uniqueListeners: stats.unique_listeners || 0,
    totalHours: parseFloat(stats.total_hours || '0'),
    mobilePlays: stats.mobile_plays || 0,
    webPlays: stats.web_plays || 0,
    avgDailyPlays: parseFloat(stats.avg_daily_plays || '0'),
    peakHour: stats.peak_hour ?? null,
    overTime,
    byPlatform,
    byEventType,
  }
}

function getDateRange(period: string): { startDate: string; endDate: string } {
  const now = new Date()
  const endDate = now.toISOString()

  const match = period.match(/^(\d+)([dmy])$/)
  if (!match) return { startDate: new Date(now.getTime() - 30 * 86400000).toISOString(), endDate }

  const [, numStr, unit] = match
  const num = parseInt(numStr)

  let startDate: Date
  switch (unit) {
    case 'd':
      startDate = new Date(now.getTime() - num * 86400000)
      break
    case 'm':
      startDate = new Date(now)
      startDate.setMonth(startDate.getMonth() - num)
      break
    case 'y':
      startDate = new Date(now)
      startDate.setFullYear(startDate.getFullYear() - num)
      break
    default:
      startDate = new Date(now.getTime() - 30 * 86400000)
  }

  return { startDate: startDate.toISOString(), endDate }
}
