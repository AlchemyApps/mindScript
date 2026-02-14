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
    const cacheKey = getCacheKey('analytics-users', { period })
    const data = await cacheQuery(
      cacheKey,
      () => getUserData(supabase, period),
      { ttl: 300, tags: ['analytics', 'users'] }
    )
    return NextResponse.json(data)
  } catch (error) {
    console.error('User analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getUserData(supabase: any, period: string) {
  const { startDate, endDate } = getDateRange(period)

  // Total users (all time, excluding deleted)
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)

  // New users in period
  const { data: newUsersInPeriod } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .is('deleted_at', null)
    .order('created_at')

  const newUsers = newUsersInPeriod || []

  // Signups over time
  const signupsOverTime = groupByDate(newUsers, period)

  // Users by subscription tier
  const { data: tierData } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .is('deleted_at', null)

  const tierCounts: Record<string, number> = {}
  for (const row of tierData || []) {
    const tier = row.subscription_tier || 'free'
    tierCounts[tier] = (tierCounts[tier] || 0) + 1
  }

  const total = totalUsers || 0
  const byTier = Object.entries(tierCounts)
    .map(([tier, count]) => ({
      tier: tier.charAt(0).toUpperCase() + tier.slice(1),
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // Users with Stripe (paying users)
  const { count: payingUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .not('stripe_customer_id', 'is', null)
    .is('deleted_at', null)

  // Recently active users (logged in within last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const { count: activeUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('last_login_at', thirtyDaysAgo)
    .is('deleted_at', null)

  // Premium users
  const { count: premiumUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_premium', true)
    .is('deleted_at', null)

  // Account status breakdown
  const { data: statusData } = await supabase
    .from('profiles')
    .select('account_status')
    .is('deleted_at', null)

  const statusCounts: Record<string, number> = {}
  for (const row of statusData || []) {
    const status = row.account_status || 'active'
    statusCounts[status] = (statusCounts[status] || 0) + 1
  }

  const byStatus = Object.entries(statusCounts)
    .map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
    }))
    .sort((a, b) => b.count - a.count)

  return {
    totalUsers: total,
    newUsersInPeriod: newUsers.length,
    activeUsers: activeUsers || 0,
    payingUsers: payingUsers || 0,
    premiumUsers: premiumUsers || 0,
    signupsOverTime,
    byTier,
    byStatus,
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
