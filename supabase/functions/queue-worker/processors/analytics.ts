import { BaseProcessor } from "./base.ts"

interface AnalyticsPayload {
  type: 'daily' | 'weekly' | 'monthly' | 'realtime'
  date?: string // ISO date for the period to aggregate
  metrics?: string[] // Specific metrics to calculate
}

interface AnalyticsResult {
  period: string
  metrics: {
    users: {
      total: number
      new: number
      active: number
    }
    tracks: {
      total: number
      created: number
      published: number
      plays: number
    }
    marketplace: {
      sales: number
      revenue: number
      averageOrderValue: number
      topSellers: Array<{ sellerId: string; revenue: number }>
    }
    engagement: {
      averageSessionDuration: number
      pageViews: number
      bounceRate: number
    }
  }
  trends: {
    userGrowth: number // Percentage
    revenueGrowth: number // Percentage
    trackGrowth: number // Percentage
  }
}

/**
 * Analytics processor for aggregating platform metrics
 */
export class AnalyticsProcessor extends BaseProcessor {
  async process(jobId: string, payload: AnalyticsPayload, metadata: any): Promise<AnalyticsResult> {
    console.log(`Processing analytics job ${jobId} for type ${payload.type}`)

    // Validate payload
    this.validatePayload(payload, ['type'])

    await this.updateProgress(jobId, 10, 'Starting analytics aggregation')

    const targetDate = payload.date ? new Date(payload.date) : new Date()
    const period = this.getPeriodBounds(payload.type, targetDate)

    try {
      await this.updateProgress(jobId, 20, 'Calculating user metrics')
      const userMetrics = await this.calculateUserMetrics(period)

      await this.updateProgress(jobId, 35, 'Calculating track metrics')
      const trackMetrics = await this.calculateTrackMetrics(period)

      await this.updateProgress(jobId, 50, 'Calculating marketplace metrics')
      const marketplaceMetrics = await this.calculateMarketplaceMetrics(period)

      await this.updateProgress(jobId, 65, 'Calculating engagement metrics')
      const engagementMetrics = await this.calculateEngagementMetrics(period)

      await this.updateProgress(jobId, 80, 'Calculating trends')
      const trends = await this.calculateTrends(period, payload.type)

      await this.updateProgress(jobId, 90, 'Storing analytics data')

      const result: AnalyticsResult = {
        period: `${period.start.toISOString()} - ${period.end.toISOString()}`,
        metrics: {
          users: userMetrics,
          tracks: trackMetrics,
          marketplace: marketplaceMetrics,
          engagement: engagementMetrics,
        },
        trends,
      }

      // Store aggregated data
      await this.storeAnalytics(payload.type, period, result)

      await this.updateProgress(jobId, 100, 'Analytics aggregation complete')

      return result

    } catch (error) {
      console.error(`Analytics job ${jobId} failed:`, error)
      throw error
    }
  }

  private getPeriodBounds(type: string, date: Date): { start: Date; end: Date } {
    const start = new Date(date)
    const end = new Date(date)

    switch (type) {
      case 'daily':
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break

      case 'weekly':
        const dayOfWeek = start.getDay()
        start.setDate(start.getDate() - dayOfWeek) // Start of week (Sunday)
        start.setHours(0, 0, 0, 0)
        end.setDate(start.getDate() + 6) // End of week (Saturday)
        end.setHours(23, 59, 59, 999)
        break

      case 'monthly':
        start.setDate(1) // First day of month
        start.setHours(0, 0, 0, 0)
        end.setMonth(end.getMonth() + 1, 0) // Last day of month
        end.setHours(23, 59, 59, 999)
        break

      case 'realtime':
        // Last hour
        start.setHours(start.getHours() - 1)
        break
    }

    return { start, end }
  }

  private async calculateUserMetrics(period: { start: Date; end: Date }) {
    // Total users
    const { count: totalUsers } = await this.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    // New users in period
    const { count: newUsers } = await this.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString())

    // Active users (with activity in period)
    const { data: activeUsersData } = await this.supabase
      .from('user_activity')
      .select('user_id', { count: 'exact' })
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString())

    const activeUsers = new Set(activeUsersData?.map(a => a.user_id) || []).size

    return {
      total: totalUsers || 0,
      new: newUsers || 0,
      active: activeUsers,
    }
  }

  private async calculateTrackMetrics(period: { start: Date; end: Date }) {
    // Total tracks
    const { count: totalTracks } = await this.supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })

    // Created in period
    const { count: createdTracks } = await this.supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString())

    // Published tracks
    const { count: publishedTracks } = await this.supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')

    // Play count for period
    const { data: playData } = await this.supabase
      .from('track_plays')
      .select('play_count')
      .gte('played_at', period.start.toISOString())
      .lte('played_at', period.end.toISOString())

    const totalPlays = playData?.reduce((sum, p) => sum + (p.play_count || 1), 0) || 0

    return {
      total: totalTracks || 0,
      created: createdTracks || 0,
      published: publishedTracks || 0,
      plays: totalPlays,
    }
  }

  private async calculateMarketplaceMetrics(period: { start: Date; end: Date }) {
    // Sales data for period
    const { data: salesData } = await this.supabase
      .from('sales')
      .select('amount, seller_id')
      .eq('status', 'completed')
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString())

    const salesCount = salesData?.length || 0
    const totalRevenue = salesData?.reduce((sum, s) => sum + s.amount, 0) || 0
    const averageOrderValue = salesCount > 0 ? totalRevenue / salesCount : 0

    // Top sellers
    const sellerRevenue: Record<string, number> = {}
    for (const sale of salesData || []) {
      sellerRevenue[sale.seller_id] = (sellerRevenue[sale.seller_id] || 0) + sale.amount
    }

    const topSellers = Object.entries(sellerRevenue)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([sellerId, revenue]) => ({ sellerId, revenue }))

    return {
      sales: salesCount,
      revenue: totalRevenue,
      averageOrderValue,
      topSellers,
    }
  }

  private async calculateEngagementMetrics(period: { start: Date; end: Date }) {
    // Get session data
    const { data: sessionData } = await this.supabase
      .from('user_sessions')
      .select('duration_seconds, page_views')
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString())

    const totalSessions = sessionData?.length || 0
    const totalDuration = sessionData?.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) || 0
    const totalPageViews = sessionData?.reduce((sum, s) => sum + (s.page_views || 1), 0) || 0
    const bouncedSessions = sessionData?.filter(s => s.page_views === 1).length || 0

    return {
      averageSessionDuration: totalSessions > 0 ? totalDuration / totalSessions : 0,
      pageViews: totalPageViews,
      bounceRate: totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0,
    }
  }

  private async calculateTrends(period: { start: Date; end: Date }, type: string) {
    // Get previous period for comparison
    const previousPeriod = this.getPreviousPeriod(period, type)

    // User growth
    const { count: currentUsers } = await this.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .lte('created_at', period.end.toISOString())

    const { count: previousUsers } = await this.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .lte('created_at', previousPeriod.end.toISOString())

    const userGrowth = this.calculateGrowthRate(previousUsers || 0, currentUsers || 0)

    // Revenue growth
    const { data: currentRevenue } = await this.supabase
      .from('sales')
      .select('amount')
      .eq('status', 'completed')
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString())

    const { data: previousRevenue } = await this.supabase
      .from('sales')
      .select('amount')
      .eq('status', 'completed')
      .gte('created_at', previousPeriod.start.toISOString())
      .lte('created_at', previousPeriod.end.toISOString())

    const currentTotal = currentRevenue?.reduce((sum, s) => sum + s.amount, 0) || 0
    const previousTotal = previousRevenue?.reduce((sum, s) => sum + s.amount, 0) || 0
    const revenueGrowth = this.calculateGrowthRate(previousTotal, currentTotal)

    // Track growth
    const { count: currentTracks } = await this.supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', period.start.toISOString())
      .lte('created_at', period.end.toISOString())

    const { count: previousTracks } = await this.supabase
      .from('tracks')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', previousPeriod.start.toISOString())
      .lte('created_at', previousPeriod.end.toISOString())

    const trackGrowth = this.calculateGrowthRate(previousTracks || 0, currentTracks || 0)

    return {
      userGrowth,
      revenueGrowth,
      trackGrowth,
    }
  }

  private getPreviousPeriod(period: { start: Date; end: Date }, type: string) {
    const duration = period.end.getTime() - period.start.getTime()
    const previousStart = new Date(period.start.getTime() - duration)
    const previousEnd = new Date(period.end.getTime() - duration)

    return { start: previousStart, end: previousEnd }
  }

  private calculateGrowthRate(previous: number, current: number): number {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  private async storeAnalytics(type: string, period: { start: Date; end: Date }, result: AnalyticsResult) {
    const { error } = await this.supabase
      .from('analytics_aggregates')
      .upsert({
        period_type: type,
        period_start: period.start.toISOString(),
        period_end: period.end.toISOString(),
        metrics: result.metrics,
        trends: result.trends,
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Failed to store analytics:', error)
    }
  }

  async healthCheck(): Promise<boolean> {
    // Check if database tables are accessible
    try {
      const { error } = await this.supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .limit(1)

      return !error
    } catch (error) {
      console.error('Analytics processor health check failed:', error)
      return false
    }
  }
}