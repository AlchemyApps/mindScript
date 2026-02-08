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
    const cacheKey = getCacheKey('analytics-revenue', { period })
    const data = await cacheQuery(
      cacheKey,
      () => getRevenueData(supabase, period),
      { ttl: 300, tags: ['analytics', 'revenue'] }
    )
    return NextResponse.json(data)
  } catch (error) {
    console.error('Revenue analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getRevenueData(supabase: any, period: string) {
  const { startDate, endDate } = getDateRange(period)

  // Fetch all purchases in period
  const { data: purchases, error: purchasesError } = await supabase
    .from('purchases')
    .select('id, amount, currency, metadata, created_at, user_id')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at')

  if (purchasesError) {
    console.warn('Purchases query error:', purchasesError.message)
  }

  const allPurchases = purchases || []

  // Total revenue
  const totalRevenue = allPurchases.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

  // Unique paying users
  const uniqueUsers = new Set(allPurchases.map((p: any) => p.user_id)).size

  // Average order value
  const averageOrderValue = allPurchases.length > 0 ? totalRevenue / allPurchases.length : 0

  // Revenue by type
  const revenueByType: Record<string, { count: number; total: number }> = {}
  for (const p of allPurchases) {
    const type = p.metadata?.type || 'track_purchase'
    if (!revenueByType[type]) {
      revenueByType[type] = { count: 0, total: 0 }
    }
    revenueByType[type].count++
    revenueByType[type].total += p.amount || 0
  }

  const byType = Object.entries(revenueByType).map(([type, data]) => ({
    type,
    count: data.count,
    total: data.total,
  }))

  // Revenue over time
  const overTime = groupByDate(allPurchases, period)

  // All-time total
  const { data: allTimePurchases } = await supabase
    .from('purchases')
    .select('amount')

  const allTimeRevenue = (allTimePurchases || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
  const totalPurchases = (allTimePurchases || []).length

  return {
    totalRevenue,
    allTimeRevenue,
    totalPurchases,
    uniquePayingUsers: uniqueUsers,
    averageOrderValue: Math.round(averageOrderValue),
    purchasesInPeriod: allPurchases.length,
    byType,
    overTime,
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
  rows: { amount?: number; created_at: string }[],
  period: string
): { date: string; amount: number; count: number }[] {
  const grouped: Record<string, { amount: number; count: number }> = {}
  const useDaily = period.includes('d') || period === '1m'

  for (const row of rows) {
    const date = new Date(row.created_at)
    const key = useDaily ? format(date, 'yyyy-MM-dd') : format(date, 'yyyy-MM')
    if (!grouped[key]) {
      grouped[key] = { amount: 0, count: 0 }
    }
    grouped[key].amount += row.amount || 0
    grouped[key].count++
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, amount: data.amount, count: data.count }))
}
