'use client'

import { useEffect, useState, useCallback } from 'react'
import { MetricsCard } from '@/components/MetricsCard'
import {
  Users,
  FileText,
  RefreshCw,
  Mic2,
  Music,
  Waves,
  Headphones,
  Loader2,
  DollarSign,
  CreditCard,
  TrendingUp,
  UserPlus,
  UserCheck,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'

// ── Types ──

interface AnalyticsData {
  voices: {
    popular: Array<{ voice_name: string; provider: string; tier: string; usage_count: number }>
  }
  backgroundTracks: {
    popular: Array<{ track_name: string; category: string; usage_count: number }>
  }
  features: {
    solfeggio: { total: number; withFeature: number; percentage: number }
    binaural: { total: number; withFeature: number; percentage: number }
    backgroundMusic: { total: number; withFeature: number; percentage: number }
  }
  tracks: {
    total: number
    overTime: Array<{ date: string; count: number }>
  }
  users: {
    total: number
    overTime: Array<{ date: string; count: number }>
  }
}

interface RevenueData {
  totalRevenue: number
  allTimeRevenue: number
  totalPurchases: number
  uniquePayingUsers: number
  averageOrderValue: number
  purchasesInPeriod: number
  byType: Array<{ type: string; count: number; total: number }>
  overTime: Array<{ date: string; amount: number; count: number }>
}

interface ContentData {
  totalTracks: number
  newTracksInPeriod: number
  creationVelocity: Array<{ date: string; count: number }>
  byCategory: Array<{ category: string; count: number }>
  withMusic: number
  withSolfeggio: number
  withBinaural: number
}

interface UserData {
  totalUsers: number
  newUsersInPeriod: number
  activeUsers: number
  payingUsers: number
  premiumUsers: number
  signupsOverTime: Array<{ date: string; count: number }>
  byTier: Array<{ tier: string; count: number; percentage: number }>
  byStatus: Array<{ status: string; count: number }>
}

type TabId = 'overview' | 'revenue' | 'content' | 'users'

// ── Main Page ──

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [period, setPeriod] = useState('30d')

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'content', label: 'Content' },
    { id: 'users', label: 'Users' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track usage, revenue, content, and user metrics
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
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab period={period} />}
      {activeTab === 'revenue' && <RevenueTab period={period} />}
      {activeTab === 'content' && <ContentTab period={period} />}
      {activeTab === 'users' && <UsersTab period={period} />}
    </div>
  )
}

// ── Info Banner Component ──

function InfoBanner({ message }: { message: string }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
      <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-blue-700 dark:text-blue-300">{message}</p>
    </div>
  )
}

// ── Overview Tab (existing dashboard) ──

function OverviewTab({ period }: { period: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch(`/api/analytics?period=${period}`)
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
  }, [period])

  useEffect(() => {
    setLoading(true)
    fetchAnalytics()
  }, [fetchAnalytics])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchAnalytics()
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Total Users"
          value={data ? formatNumber(data.users.total) : '-'}
          icon={<Users className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Total Tracks"
          value={data ? formatNumber(data.tracks.total) : '-'}
          icon={<FileText className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Solfeggio Adoption"
          value={data ? `${data.features.solfeggio.percentage}%` : '-'}
          subtitle={data ? `${data.features.solfeggio.withFeature} of ${data.features.solfeggio.total} tracks` : undefined}
          icon={<Waves className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Binaural Adoption"
          value={data ? `${data.features.binaural.percentage}%` : '-'}
          subtitle={data ? `${data.features.binaural.withFeature} of ${data.features.binaural.total} tracks` : undefined}
          icon={<Headphones className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Popularity Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Voices */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mic2 className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Popular Voices
            </h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : data?.voices.popular.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No voice usage data yet</p>
          ) : (
            <div className="space-y-3">
              {data?.voices.popular.map((voice, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-400 w-6">{i + 1}.</span>
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {voice.voice_name}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 capitalize">{voice.provider}</span>
                        <TierBadge tier={voice.tier} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${data.voices.popular.length > 0
                            ? (voice.usage_count / data.voices.popular[0].usage_count) * 100
                            : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-10 text-right">
                      {voice.usage_count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Popular Background Tracks */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Music className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Popular Background Tracks
            </h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : data?.backgroundTracks.popular.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">No background track usage data yet</p>
          ) : (
            <div className="space-y-3">
              {data?.backgroundTracks.popular.map((track, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-400 w-6">{i + 1}.</span>
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {track.track_name}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">{track.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full"
                        style={{
                          width: `${data.backgroundTracks.popular.length > 0
                            ? (track.usage_count / data.backgroundTracks.popular[0].usage_count) * 100
                            : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-10 text-right">
                      {track.usage_count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tracks Over Time */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Tracks Created Over Time
          </h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : !data?.tracks.overTime.length ? (
            <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
              No data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.tracks.overTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => {
                    const d = new Date(val)
                    return `${d.getMonth() + 1}/${d.getDate()}`
                  }}
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis fontSize={12} tick={{ fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Tracks" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Users Over Time */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            New Users Over Time
          </h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : !data?.users.overTime.length ? (
            <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
              No data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.users.overTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => {
                    const d = new Date(val)
                    return `${d.getMonth() + 1}/${d.getDate()}`
                  }}
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis fontSize={12} tick={{ fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Users" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Feature Adoption Summary */}
      {data && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Feature Adoption
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <AdoptionBar
              label="Solfeggio Frequencies"
              percentage={data.features.solfeggio.percentage}
              count={data.features.solfeggio.withFeature}
              total={data.features.solfeggio.total}
              color="bg-purple-500"
            />
            <AdoptionBar
              label="Binaural Beats"
              percentage={data.features.binaural.percentage}
              count={data.features.binaural.withFeature}
              total={data.features.binaural.total}
              color="bg-blue-500"
            />
            <AdoptionBar
              label="Background Music"
              percentage={data.features.backgroundMusic.percentage}
              count={data.features.backgroundMusic.withFeature}
              total={data.features.backgroundMusic.total}
              color="bg-emerald-500"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Revenue Tab ──

function RevenueTab({ period }: { period: string }) {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/revenue?period=${period}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch revenue data')
        return res.json()
      })
      .then(setData)
      .catch((err) => {
        console.error('Revenue fetch error:', err)
        toast.error('Failed to load revenue data')
      })
      .finally(() => setLoading(false))
  }, [period])

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100)
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  const typeLabels: Record<string, string> = {
    track_purchase: 'Track Purchases',
    voice_clone: 'Voice Cloning',
    track_edit: 'Track Edits',
    unknown: 'Other',
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Revenue (Period)"
          value={data ? formatCurrency(data.totalRevenue) : '-'}
          icon={<DollarSign className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="All-Time Revenue"
          value={data ? formatCurrency(data.allTimeRevenue) : '-'}
          subtitle={data ? `${data.totalPurchases} total purchases` : undefined}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Unique Paying Users"
          value={data ? String(data.uniquePayingUsers) : '-'}
          subtitle="In selected period"
          icon={<Users className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Avg Order Value"
          value={data ? formatCurrency(data.averageOrderValue) : '-'}
          subtitle={data ? `${data.purchasesInPeriod} purchases in period` : undefined}
          icon={<CreditCard className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Revenue Over Time */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Revenue Over Time
        </h3>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !data?.overTime.length ? (
          <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
            No revenue data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.overTime}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={(val) => {
                  const d = new Date(val)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
                fontSize={12}
                tick={{ fill: '#6b7280' }}
              />
              <YAxis
                fontSize={12}
                tick={{ fill: '#6b7280' }}
                tickFormatter={(val) => `$${(val / 100).toFixed(0)}`}
              />
              <Tooltip
                labelFormatter={(val) => new Date(val).toLocaleDateString()}
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Revenue by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Revenue by Type
          </h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : !data?.byType.length ? (
            <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
              No purchase data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.byType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total"
                  label={({ type, percent }: any) => `${typeLabels[type] || type} ${((percent as number) * 100).toFixed(0)}%`}
                >
                  {data.byType.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue Breakdown Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Breakdown
          </h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {data?.byType.map((item) => (
                <div key={item.type} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {typeLabels[item.type] || item.type}
                    </p>
                    <p className="text-xs text-gray-500">{item.count} purchases</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {formatCurrency(item.total)}
                  </span>
                </div>
              ))}
              {(!data?.byType || data.byType.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-8">No purchase data for this period</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Content Tab ──

function ContentTab({ period }: { period: string }) {
  const [data, setData] = useState<ContentData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/content?period=${period}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch content data')
        return res.json()
      })
      .then(setData)
      .catch((err) => {
        console.error('Content fetch error:', err)
        toast.error('Failed to load content data')
      })
      .finally(() => setLoading(false))
  }, [period])

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  return (
    <div className="space-y-6">
      <InfoBanner message="Plays, downloads, ratings, and rendering metrics will be available once playback tracking is integrated. Showing track creation data from the database." />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Total Tracks"
          value={data ? formatNumber(data.totalTracks) : '-'}
          icon={<FileText className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="New in Period"
          value={data ? formatNumber(data.newTracksInPeriod) : '-'}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="With Music"
          value={data ? formatNumber(data.withMusic) : '-'}
          subtitle="In selected period"
          icon={<Music className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="With Frequencies"
          value={data ? formatNumber(data.withSolfeggio + data.withBinaural) : '-'}
          subtitle={data ? `${data.withSolfeggio} solfeggio, ${data.withBinaural} binaural` : undefined}
          icon={<Waves className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Creation Velocity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Content Creation Velocity
        </h3>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !data?.creationVelocity.length ? (
          <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
            No data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.creationVelocity}>
              <defs>
                <linearGradient id="colorContent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={(val) => {
                  const d = new Date(val)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
                fontSize={12}
                tick={{ fill: '#6b7280' }}
              />
              <YAxis fontSize={12} tick={{ fill: '#6b7280' }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(val) => new Date(val).toLocaleDateString()}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorContent)"
                name="Tracks Created"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Background Track Usage */}
      {data && data.byCategory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Background Track Usage (Period)
          </h3>
          <div className="space-y-3">
            {data.byCategory.slice(0, 10).map((cat) => (
              <div key={cat.category} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {cat.category === 'none' ? 'No music' : cat.category.replace(/-/g, ' ')}
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full"
                      style={{
                        width: `${data.byCategory.length > 0
                          ? (cat.count / data.byCategory[0].count) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-8 text-right">
                    {cat.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Users Tab (real data) ──

function UsersTab({ period }: { period: string }) {
  const [data, setData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/users?period=${period}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch user data')
        return res.json()
      })
      .then(setData)
      .catch((err) => {
        console.error('Users fetch error:', err)
        toast.error('Failed to load user data')
      })
      .finally(() => setLoading(false))
  }, [period])

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  return (
    <div className="space-y-6">
      <InfoBanner message="Retention cohorts, geographic distribution, and device breakdown require session tracking integration (e.g. PostHog or a custom events table). These will populate once an analytics event pipeline is added." />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Total Users"
          value={data ? formatNumber(data.totalUsers) : '-'}
          icon={<Users className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="New Users"
          value={data ? formatNumber(data.newUsersInPeriod) : '-'}
          subtitle="In selected period"
          icon={<UserPlus className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Active Users"
          value={data ? formatNumber(data.activeUsers) : '-'}
          subtitle="Logged in last 30 days"
          icon={<UserCheck className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Paying Users"
          value={data ? formatNumber(data.payingUsers) : '-'}
          subtitle="With Stripe customer ID"
          icon={<CreditCard className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Signups Over Time */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          New Signups Over Time
        </h3>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !data?.signupsOverTime.length ? (
          <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
            No signups in this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.signupsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={(val) => {
                  const d = new Date(val)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
                fontSize={12}
                tick={{ fill: '#6b7280' }}
              />
              <YAxis fontSize={12} tick={{ fill: '#6b7280' }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(val) => new Date(val).toLocaleDateString()}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Signups" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tier + Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Tiers */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Users by Subscription Tier
          </h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : !data?.byTier.length ? (
            <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
              No tier data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.byTier}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ tier, percentage }: any) => `${tier} (${(percentage as number).toFixed(1)}%)`}
                >
                  {data.byTier.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Account Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Account Status Breakdown
          </h3>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {data?.byStatus.map((item) => (
                <div key={item.status} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      item.status.toLowerCase() === 'active' ? 'bg-green-500' :
                      item.status.toLowerCase() === 'suspended' ? 'bg-red-500' :
                      'bg-gray-400'
                    }`} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.status}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {formatNumber(item.count)}
                  </span>
                </div>
              ))}
              {(!data?.byStatus || data.byStatus.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-8">No status data</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared Components ──

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    included: 'bg-green-100 text-green-700',
    premium: 'bg-purple-100 text-purple-700',
    custom: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${colors[tier] || 'bg-gray-100 text-gray-600'}`}>
      {tier}
    </span>
  )
}

function AdoptionBar({ label, percentage, count, total, color }: {
  label: string
  percentage: number
  count: number
  total: number
  color: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm font-bold text-gray-900 dark:text-white">{percentage}%</span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
        <div
          className={`${color} h-3 rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        {count} of {total} tracks
      </p>
    </div>
  )
}
