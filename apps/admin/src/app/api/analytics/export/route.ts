import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parse } from 'papaparse'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'csv'
  const metric = searchParams.get('metric') || 'all'
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
    // Fetch all analytics data
    const analyticsData = await fetchAnalyticsData(supabase, metric, period)

    if (format === 'csv') {
      const csv = generateCSV(analyticsData)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="analytics-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    } else if (format === 'json') {
      return NextResponse.json(analyticsData, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="analytics-${new Date().toISOString().split('T')[0]}.json"`,
        },
      })
    } else if (format === 'excel') {
      const excel = await generateExcel(analyticsData)
      return new NextResponse(excel, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="analytics-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      })
    } else {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}

async function fetchAnalyticsData(supabase: any, metric: string, period: string) {
  const data: any = {}

  if (metric === 'all' || metric === 'revenue') {
    // Fetch revenue data
    const { data: payments } = await supabase
      .from('payments')
      .select('*')
      .gte('created_at', getDateFromPeriod(period))

    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')

    data.revenue = {
      total: payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0,
      mrr: subscriptions?.reduce((sum: number, s: any) => sum + (s.price_amount / 100), 0) || 0,
      transactions: payments || [],
      activeSubscriptions: subscriptions?.length || 0,
    }
  }

  if (metric === 'all' || metric === 'users') {
    // Fetch user data
    const { data: users } = await supabase
      .from('profiles')
      .select('*')
      .gte('created_at', getDateFromPeriod(period))

    const { data: allUsers } = await supabase
      .from('profiles')
      .select('id, email, created_at, subscription_tier')

    data.users = {
      total: allUsers?.length || 0,
      new: users?.length || 0,
      byTier: groupByTier(allUsers || []),
      list: allUsers || [],
    }
  }

  if (metric === 'all' || metric === 'content') {
    // Fetch content data
    const { data: tracks } = await supabase
      .from('tracks')
      .select('*')
      .gte('created_at', getDateFromPeriod(period))

    const { data: allTracks } = await supabase
      .from('tracks')
      .select('id, title, play_count, download_count, created_at')

    data.content = {
      total: allTracks?.length || 0,
      new: tracks?.length || 0,
      totalPlays: allTracks?.reduce((sum: number, t: any) => sum + (t.play_count || 0), 0) || 0,
      totalDownloads: allTracks?.reduce((sum: number, t: any) => sum + (t.download_count || 0), 0) || 0,
      tracks: allTracks || [],
    }
  }

  data.metadata = {
    exportDate: new Date().toISOString(),
    period,
    metric,
  }

  return data
}

function generateCSV(data: any): string {
  const sheets: any[] = []

  // Revenue sheet
  if (data.revenue) {
    sheets.push({
      name: 'Revenue Summary',
      data: [
        ['Metric', 'Value'],
        ['Total Revenue', data.revenue.total],
        ['Monthly Recurring Revenue', data.revenue.mrr],
        ['Active Subscriptions', data.revenue.activeSubscriptions],
      ],
    })

    if (data.revenue.transactions.length > 0) {
      sheets.push({
        name: 'Transactions',
        data: [
          ['Date', 'Amount', 'Status', 'Customer ID'],
          ...data.revenue.transactions.map((t: any) => [
            t.created_at,
            t.amount,
            t.status,
            t.customer_id,
          ]),
        ],
      })
    }
  }

  // Users sheet
  if (data.users) {
    sheets.push({
      name: 'User Summary',
      data: [
        ['Metric', 'Value'],
        ['Total Users', data.users.total],
        ['New Users', data.users.new],
        ...Object.entries(data.users.byTier).map(([tier, count]) => [
          `Users - ${tier}`,
          count,
        ]),
      ],
    })

    if (data.users.list.length > 0) {
      sheets.push({
        name: 'User List',
        data: [
          ['ID', 'Email', 'Created At', 'Subscription Tier'],
          ...data.users.list.map((u: any) => [
            u.id,
            u.email,
            u.created_at,
            u.subscription_tier || 'free',
          ]),
        ],
      })
    }
  }

  // Content sheet
  if (data.content) {
    sheets.push({
      name: 'Content Summary',
      data: [
        ['Metric', 'Value'],
        ['Total Tracks', data.content.total],
        ['New Tracks', data.content.new],
        ['Total Plays', data.content.totalPlays],
        ['Total Downloads', data.content.totalDownloads],
      ],
    })

    if (data.content.tracks.length > 0) {
      sheets.push({
        name: 'Track List',
        data: [
          ['ID', 'Title', 'Play Count', 'Download Count', 'Created At'],
          ...data.content.tracks.map((t: any) => [
            t.id,
            t.title,
            t.play_count || 0,
            t.download_count || 0,
            t.created_at,
          ]),
        ],
      })
    }
  }

  // Combine all sheets into CSV format
  const csvParts = sheets.map(sheet => {
    const csvContent = sheet.data.map((row: any[]) => row.join(',')).join('\n')
    return `## ${sheet.name}\n${csvContent}`
  })

  return csvParts.join('\n\n')
}

async function generateExcel(data: any): Promise<ArrayBuffer> {
  // For now, we'll use a simple CSV format that Excel can read
  // In production, you'd use a library like xlsx
  const csv = generateCSV(data)
  const encoder = new TextEncoder()
  const uint8Array = encoder.encode(csv)
  return uint8Array.buffer
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

function groupByTier(users: any[]): Record<string, number> {
  const tiers: Record<string, number> = {
    free: 0,
    basic: 0,
    pro: 0,
    enterprise: 0,
  }

  users.forEach(user => {
    const tier = user.subscription_tier || 'free'
    tiers[tier] = (tiers[tier] || 0) + 1
  })

  return tiers
}