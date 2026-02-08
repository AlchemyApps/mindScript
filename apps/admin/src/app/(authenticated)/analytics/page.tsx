'use client'

import { useEffect, useState, useCallback } from 'react'
import { MetricsCard } from '@/components/MetricsCard'
import {
  Users,
  FileText,
  Download,
  RefreshCw,
  Mic2,
  Music,
  Waves,
  Headphones,
  Loader2,
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
} from 'recharts'

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

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState('30d')

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

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value)
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
            Track usage, voice popularity, and feature adoption
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
