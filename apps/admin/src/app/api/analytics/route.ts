import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { cacheQuery, getCacheKey } from '@/lib/cache'
import { format } from 'date-fns'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '30d'

  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cacheKey = getCacheKey('analytics-dashboard', { period })
    const data = await cacheQuery(
      cacheKey,
      () => getAnalyticsData(supabase, period),
      { ttl: 300, tags: ['analytics'] }
    )
    return NextResponse.json(data)
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getAnalyticsData(supabase: ReturnType<typeof Object>, period: string) {
  const { startDate, endDate } = getDateRange(period)

  const safeDefaults = {
    voices: { popular: [] as { voice_name: string; provider: string; tier: string; usage_count: number }[] },
    backgroundTracks: { popular: [] as { track_name: string; category: string; usage_count: number }[] },
    features: {
      solfeggio: { total: 0, withFeature: 0, percentage: 0 },
      binaural: { total: 0, withFeature: 0, percentage: 0 },
      backgroundMusic: { total: 0, withFeature: 0, percentage: 0 },
    },
    tracks: { total: 0, overTime: [] as { date: string; count: number }[] },
    users: { total: 0, overTime: [] as { date: string; count: number }[] },
  }

  const [voices, bgTracks, features, trackStats, userStats] = await Promise.all([
    getPopularVoices(supabase, startDate, endDate).catch((e) => {
      console.warn('Popular voices unavailable:', e.message)
      return safeDefaults.voices
    }),
    getPopularBackgroundTracks(supabase, startDate, endDate).catch((e) => {
      console.warn('Popular bg tracks unavailable:', e.message)
      return safeDefaults.backgroundTracks
    }),
    getFeatureAdoption(supabase, startDate, endDate).catch((e) => {
      console.warn('Feature adoption unavailable:', e.message)
      return safeDefaults.features
    }),
    getTrackStats(supabase, startDate, endDate, period).catch((e) => {
      console.warn('Track stats unavailable:', e.message)
      return safeDefaults.tracks
    }),
    getUserStats(supabase, startDate, endDate, period).catch((e) => {
      console.warn('User stats unavailable:', e.message)
      return safeDefaults.users
    }),
  ])

  return {
    voices,
    backgroundTracks: bgTracks,
    features,
    tracks: trackStats,
    users: userStats,
  }
}

async function getPopularVoices(supabase: any, startDate: string, endDate: string) {
  const { data, error } = await supabase.rpc('get_popular_voices', {
    start_date: startDate,
    end_date: endDate,
    max_results: 10,
  })

  if (error) throw error

  return {
    popular: (data || []).map((row: any) => ({
      voice_name: row.voice_name,
      provider: row.provider,
      tier: row.tier,
      usage_count: Number(row.usage_count),
    })),
  }
}

async function getPopularBackgroundTracks(supabase: any, startDate: string, endDate: string) {
  const { data, error } = await supabase.rpc('get_popular_background_tracks', {
    start_date: startDate,
    end_date: endDate,
    max_results: 10,
  })

  if (error) throw error

  return {
    popular: (data || []).map((row: any) => ({
      track_name: row.track_name,
      category: row.category || 'Unknown',
      usage_count: Number(row.usage_count),
    })),
  }
}

async function getFeatureAdoption(supabase: any, startDate: string, endDate: string) {
  const { data, error } = await supabase.rpc('get_feature_adoption', {
    start_date: startDate,
    end_date: endDate,
  })

  if (error) throw error

  const row = data?.[0] || {
    total_tracks: 0,
    solfeggio_count: 0,
    solfeggio_pct: 0,
    binaural_count: 0,
    binaural_pct: 0,
    with_music_count: 0,
    with_music_pct: 0,
  }

  return {
    solfeggio: {
      total: Number(row.total_tracks),
      withFeature: Number(row.solfeggio_count),
      percentage: Number(row.solfeggio_pct) || 0,
    },
    binaural: {
      total: Number(row.total_tracks),
      withFeature: Number(row.binaural_count),
      percentage: Number(row.binaural_pct) || 0,
    },
    backgroundMusic: {
      total: Number(row.total_tracks),
      withFeature: Number(row.with_music_count),
      percentage: Number(row.with_music_pct) || 0,
    },
  }
}

async function getTrackStats(supabase: any, startDate: string, endDate: string, period: string) {
  // Total tracks (all time)
  const { count: total } = await supabase
    .from('tracks')
    .select('*', { count: 'exact', head: true })

  // Tracks in period for over-time chart
  const { data: tracksInPeriod } = await supabase
    .from('tracks')
    .select('created_at')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at')

  const overTime = groupByDate(tracksInPeriod || [], period)

  return { total: total || 0, overTime }
}

async function getUserStats(supabase: any, startDate: string, endDate: string, period: string) {
  // Total users (all time)
  const { count: total } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  // Users in period for over-time chart
  const { data: usersInPeriod } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at')

  const overTime = groupByDate(usersInPeriod || [], period)

  return { total: total || 0, overTime }
}

// ── Helpers ──

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

function groupByDate(rows: { created_at: string }[], period: string): { date: string; count: number }[] {
  const grouped: Record<string, number> = {}
  const useDaily = period.includes('d') || period === '1m'

  for (const row of rows) {
    const date = new Date(row.created_at)
    const key = useDaily ? format(date, 'yyyy-MM-dd') : format(date, 'yyyy-MM')
    grouped[key] = (grouped[key] || 0) + 1
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))
}
