'use client'

import { useEffect, useState } from 'react'
import { MetricsCard } from '@/components/MetricsCard'
import {
  FileText,
  Play,
  Download,
  TrendingUp,
  Music,
  Clock,
  RefreshCw,
  Filter,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
  Legend,
} from 'recharts'
import { toast } from 'sonner'

interface ContentData {
  totalTracks: number
  newTracks: number
  totalPlays: number
  totalDownloads: number
  avgTrackLength: string
  contentVelocity: Array<{ date: string; count: number }>
  topTracks: Array<{
    id: string
    title: string
    play_count: number
    download_count: number
    creator: string
  }>
  popularCategories: Array<{
    category: string
    count: number
    plays: number
  }>
  performanceByDay: Array<{
    day: string
    plays: number
    downloads: number
    created: number
  }>
  contentQuality: {
    avgRating: number
    totalRatings: number
    avgCompletionRate: number
  }
  renderingMetrics: {
    avgRenderTime: string
    queueSize: number
    successRate: number
    failureRate: number
  }
}

export default function ContentPage() {
  const [data, setData] = useState<ContentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState('30d')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    fetchContentData()
  }, [period, category])

  const fetchContentData = async () => {
    try {
      // Simulated data for now
      const mockData: ContentData = {
        totalTracks: 4523,
        newTracks: 234,
        totalPlays: 125430,
        totalDownloads: 8934,
        avgTrackLength: '5m 23s',
        contentVelocity: generateMockContentVelocity(period),
        topTracks: [
          { id: '1', title: 'Deep Focus Session', play_count: 5234, download_count: 432, creator: 'MindfulCreator' },
          { id: '2', title: 'Morning Meditation', play_count: 4823, download_count: 387, creator: 'ZenMaster' },
          { id: '3', title: 'Sleep Journey', play_count: 4234, download_count: 356, creator: 'DreamWeaver' },
          { id: '4', title: 'Productivity Boost', play_count: 3876, download_count: 298, creator: 'FocusGuru' },
          { id: '5', title: 'Stress Relief', play_count: 3543, download_count: 276, creator: 'CalmSpace' },
        ],
        popularCategories: [
          { category: 'Meditation', count: 1234, plays: 45234 },
          { category: 'Sleep', count: 987, plays: 38934 },
          { category: 'Focus', count: 876, plays: 32456 },
          { category: 'Relaxation', count: 765, plays: 28765 },
          { category: 'Mindfulness', count: 661, plays: 24567 },
        ],
        performanceByDay: generateMockPerformanceData(),
        contentQuality: {
          avgRating: 4.3,
          totalRatings: 8234,
          avgCompletionRate: 72.5,
        },
        renderingMetrics: {
          avgRenderTime: '2m 15s',
          queueSize: 23,
          successRate: 98.5,
          failureRate: 1.5,
        },
      }
      setData(mockData)
    } catch (error) {
      console.error('Error fetching content data:', error)
      toast.error('Failed to load content analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const generateMockContentVelocity = (period: string) => {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
    const data = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      data.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 20) + 5,
      })
    }

    return data
  }

  const generateMockPerformanceData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return days.map(day => ({
      day,
      plays: Math.floor(Math.random() * 20000) + 10000,
      downloads: Math.floor(Math.random() * 2000) + 500,
      created: Math.floor(Math.random() * 50) + 10,
    }))
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchContentData()
  }

  const handleExport = async () => {
    toast.success('Content analytics exported')
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Content Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track content performance and engagement
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">All Categories</option>
            <option value="meditation">Meditation</option>
            <option value="sleep">Sleep</option>
            <option value="focus">Focus</option>
            <option value="relaxation">Relaxation</option>
          </select>
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Total Tracks"
          value={data ? formatNumber(data.totalTracks) : '-'}
          icon={<FileText className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="New Tracks"
          value={data ? formatNumber(data.newTracks) : '-'}
          subtitle={`In selected period`}
          change={12.5}
          icon={<Music className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Total Plays"
          value={data ? formatNumber(data.totalPlays) : '-'}
          subtitle={`In selected period`}
          change={23.4}
          icon={<Play className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Total Downloads"
          value={data ? formatNumber(data.totalDownloads) : '-'}
          subtitle={`In selected period`}
          change={15.7}
          icon={<Download className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Content Creation Velocity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Content Creation Velocity
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={data?.contentVelocity}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorContent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#10b981"
              fillOpacity={1}
              fill="url(#colorContent)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Performance and Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance by Day */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Performance by Day
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={data?.performanceByDay}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="plays" stroke="#3b82f6" name="Plays" />
              <Line type="monotone" dataKey="downloads" stroke="#10b981" name="Downloads" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Popular Categories */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Popular Categories
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data?.popularCategories}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="plays"
                label={({ category, plays }) => `${category}`}
              >
                {data?.popularCategories.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Performing Tracks */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Top Performing Tracks
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Track
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Creator
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Plays
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Downloads
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Engagement Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data?.topTracks.map((track) => (
                <tr key={track.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {track.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {track.creator}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatNumber(track.play_count)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatNumber(track.download_count)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {((track.download_count / track.play_count) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Content Quality & Rendering Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Content Quality */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Content Quality Metrics
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Average Rating</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {data?.contentQuality.avgRating.toFixed(1)}
                </span>
                <span className="text-gray-500">/ 5.0</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Total Ratings</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {data ? formatNumber(data.contentQuality.totalRatings) : '-'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Avg Completion Rate</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {data?.contentQuality.avgCompletionRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Rendering Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Audio Rendering Metrics
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Avg Render Time</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {data?.renderingMetrics.avgRenderTime}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Queue Size</span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {data?.renderingMetrics.queueSize}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Success Rate</span>
              <span className="text-xl font-bold text-green-600">
                {data?.renderingMetrics.successRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Failure Rate</span>
              <span className="text-xl font-bold text-red-600">
                {data?.renderingMetrics.failureRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}