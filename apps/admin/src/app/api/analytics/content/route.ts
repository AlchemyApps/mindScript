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
    const cacheKey = getCacheKey('analytics-content', { period })
    const data = await cacheQuery(
      cacheKey,
      () => getContentData(supabase, period),
      { ttl: 300, tags: ['analytics', 'content'] }
    )
    return NextResponse.json(data)
  } catch (error) {
    console.error('Content analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getContentData(supabase: any, period: string) {
  const { startDate, endDate } = getDateRange(period)

  // Total tracks (all time)
  const { count: totalTracks } = await supabase
    .from('tracks')
    .select('*', { count: 'exact', head: true })

  // Tracks in period
  const { data: tracksInPeriod } = await supabase
    .from('tracks')
    .select('created_at, music_config, frequency_config, output_config')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at')

  const tracks = tracksInPeriod || []

  // Creation velocity (tracks over time)
  const creationVelocity = groupByDate(tracks, period)

  // Track categories from music_config
  const categoryMap: Record<string, number> = {}
  for (const track of tracks) {
    const slug = track.music_config?.slug || track.music_config?.trackSlug || 'none'
    categoryMap[slug] = (categoryMap[slug] || 0) + 1
  }

  const byCategory = Object.entries(categoryMap)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)

  // Track characteristics
  const withMusic = tracks.filter((t: any) => t.music_config?.slug || t.music_config?.trackSlug).length
  const withSolfeggio = tracks.filter((t: any) => t.frequency_config?.solfeggio).length
  const withBinaural = tracks.filter((t: any) => t.frequency_config?.binaural).length

  return {
    totalTracks: totalTracks || 0,
    newTracksInPeriod: tracks.length,
    creationVelocity,
    byCategory,
    withMusic,
    withSolfeggio,
    withBinaural,
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

function groupByDate(
  rows: { created_at: string }[],
  period: string
): { date: string; count: number }[] {
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
