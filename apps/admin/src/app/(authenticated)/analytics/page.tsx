'use client'

import { useEffect, useState } from 'react'
import { MetricsCard } from '@/components/MetricsCard'
// import { RevenueChart } from '@/components/charts/RevenueChart'
// import { UserGrowthChart } from '@/components/charts/UserGrowthChart'
import {
  DollarSign,
  Users,
  FileText,
  TrendingUp,
  Activity,
  Download,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

interface AnalyticsData {
  revenue: {
    mrr: number
    arr: number
    churnRate: number
    totalRevenue: number
    revenueByPeriod: Array<{ date: string; amount: number }>
    growth: number
  }
  users: {
    totalUsers: number
    newUsers: number
    activeUsers: number
    userGrowth: Array<{ date: string; count: number }>
    retentionRate: number
  }
  content: {
    totalTracks: number
    newTracks: number
    totalPlays: number
    totalDownloads: number
    contentVelocity: Array<{ date: string; count: number }>
  }
  platform: {
    errorRate: number
    systemHealth: {
      database: string
      storage: string
      audioProcessor: string
      apiLatency: string
    }
    avgResponseTime: string
    uptime: string
  }
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/analytics?metric=overview&period=${period}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')
      const analyticsData = await response.json()
      setData(analyticsData)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error('Failed to load analytics data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchAnalytics()
  }

  const handleExport = async () => {
    try {
      const response = await fetch('/api/analytics/export?format=csv')
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      toast.success('Analytics exported successfully')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export analytics')
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Platform metrics and business intelligence
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Monthly Recurring Revenue"
          value={data ? formatCurrency(data.revenue.mrr) : '-'}
          change={data?.revenue.growth}
          icon={<DollarSign className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Annual Recurring Revenue"
          value={data ? formatCurrency(data.revenue.arr) : '-'}
          subtitle="Based on current MRR"
          icon={<TrendingUp className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Churn Rate"
          value={data ? formatPercentage(data.revenue.churnRate) : '-'}
          subtitle="Last 30 days"
          change={data?.revenue.churnRate ? -data.revenue.churnRate : undefined}
          icon={<Activity className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Total Revenue"
          value={data ? formatCurrency(data.revenue.totalRevenue) : '-'}
          subtitle={`In selected period`}
          icon={<DollarSign className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Charts - Temporarily disabled due to dependency issues */}
      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data && (
          <>
            <RevenueChart data={data.revenue.revenueByPeriod} type="area" />
            <UserGrowthChart data={data.users.userGrowth} />
          </>
        )}
      </div> */}

      {/* User Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Total Users"
          value={data ? formatNumber(data.users.totalUsers) : '-'}
          icon={<Users className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="New Users"
          value={data ? formatNumber(data.users.newUsers) : '-'}
          subtitle={`In selected period`}
          icon={<Users className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Active Users"
          value={data ? formatNumber(data.users.activeUsers) : '-'}
          subtitle="Last 30 days"
          icon={<Activity className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Retention Rate"
          value={data ? formatPercentage(data.users.retentionRate) : '-'}
          subtitle="30-day retention"
          icon={<TrendingUp className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Content Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Total Tracks"
          value={data ? formatNumber(data.content.totalTracks) : '-'}
          icon={<FileText className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="New Tracks"
          value={data ? formatNumber(data.content.newTracks) : '-'}
          subtitle={`In selected period`}
          icon={<FileText className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Total Plays"
          value={data ? formatNumber(data.content.totalPlays) : '-'}
          subtitle={`In selected period`}
          icon={<Activity className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Total Downloads"
          value={data ? formatNumber(data.content.totalDownloads) : '-'}
          subtitle={`In selected period`}
          icon={<Download className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Platform Health */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Platform Health
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Database</p>
            <p className="font-medium text-green-600">
              {data?.platform.systemHealth.database || '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Storage</p>
            <p className="font-medium text-green-600">
              {data?.platform.systemHealth.storage || '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Audio Processor</p>
            <p className={`font-medium ${
              data?.platform.systemHealth.audioProcessor === 'busy'
                ? 'text-yellow-600'
                : 'text-green-600'
            }`}>
              {data?.platform.systemHealth.audioProcessor || '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">API Latency</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {data?.platform.systemHealth.apiLatency || '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Error Rate</p>
            <p className={`font-medium ${
              (data?.platform.errorRate || 0) > 5
                ? 'text-red-600'
                : 'text-green-600'
            }`}>
              {data ? formatPercentage(data.platform.errorRate) : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Avg Response Time</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {data?.platform.avgResponseTime || '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Uptime</p>
            <p className="font-medium text-green-600">
              {data?.platform.uptime || '-'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}