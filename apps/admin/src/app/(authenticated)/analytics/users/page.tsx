'use client'

import { useEffect, useState } from 'react'
import { MetricsCard } from '@/components/MetricsCard'
import { UserGrowthChart } from '@/components/charts/UserGrowthChart'
import {
  Users,
  UserPlus,
  UserCheck,
  Activity,
  TrendingUp,
  RefreshCw,
  Download,
} from 'lucide-react'
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
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { toast } from 'sonner'

interface UserData {
  totalUsers: number
  newUsers: number
  activeUsers: number
  churned: number
  userGrowth: Array<{ date: string; count: number }>
  retentionRate: number
  avgSessionDuration: string
  cohortData: Array<{ tier: string; count: number; percentage: number }>
  usersByCountry: Array<{ country: string; count: number }>
  deviceBreakdown: Array<{ device: string; count: number }>
  retentionCohorts: Array<{
    cohort: string
    day1: number
    day7: number
    day30: number
    day90: number
  }>
}

export default function UsersPage() {
  const [data, setData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    fetchUserData()
  }, [period])

  const fetchUserData = async () => {
    try {
      // Simulated data for now
      const mockData: UserData = {
        totalUsers: 15234,
        newUsers: 1523,
        activeUsers: 8234,
        churned: 234,
        retentionRate: 78.5,
        avgSessionDuration: '12m 45s',
        userGrowth: generateMockUserGrowth(period),
        cohortData: [
          { tier: 'Free', count: 8000, percentage: 52.5 },
          { tier: 'Basic', count: 4500, percentage: 29.5 },
          { tier: 'Pro', count: 2234, percentage: 14.7 },
          { tier: 'Enterprise', count: 500, percentage: 3.3 },
        ],
        usersByCountry: [
          { country: 'United States', count: 6543 },
          { country: 'United Kingdom', count: 2345 },
          { country: 'Canada', count: 1876 },
          { country: 'Germany', count: 1456 },
          { country: 'France', count: 1234 },
          { country: 'Others', count: 1780 },
        ],
        deviceBreakdown: [
          { device: 'Desktop', count: 7543 },
          { device: 'Mobile', count: 5234 },
          { device: 'Tablet', count: 2457 },
        ],
        retentionCohorts: [
          { cohort: 'Jan 2024', day1: 100, day7: 75, day30: 55, day90: 42 },
          { cohort: 'Feb 2024', day1: 100, day7: 78, day30: 58, day90: 45 },
          { cohort: 'Mar 2024', day1: 100, day7: 80, day30: 60, day90: 48 },
          { cohort: 'Apr 2024', day1: 100, day7: 82, day30: 62, day90: 50 },
        ],
      }
      setData(mockData)
    } catch (error) {
      console.error('Error fetching user data:', error)
      toast.error('Failed to load user analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const generateMockUserGrowth = (period: string) => {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
    const data = []
    const now = new Date()
    let total = 10000

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const newUsers = Math.floor(Math.random() * 100) + 20
      total += newUsers
      data.push({
        date: date.toISOString().split('T')[0],
        count: newUsers,
        cumulative: total,
      })
    }

    return data
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchUserData()
  }

  const handleExport = async () => {
    toast.success('User analytics exported')
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            User Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            User behavior and engagement metrics
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
          value={data ? formatNumber(data.newUsers) : '-'}
          subtitle={`In selected period`}
          change={15.3}
          icon={<UserPlus className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Active Users"
          value={data ? formatNumber(data.activeUsers) : '-'}
          subtitle="Last 30 days"
          change={8.2}
          icon={<UserCheck className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Retention Rate"
          value={data ? `${data.retentionRate}%` : '-'}
          subtitle="30-day retention"
          change={-2.3}
          icon={<TrendingUp className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* User Growth Chart */}
      {data && <UserGrowthChart data={data.userGrowth} height={400} />}

      {/* User Segments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Tiers */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Users by Subscription Tier
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data?.cohortData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                label={({ tier, percentage }) => `${tier} (${percentage.toFixed(1)}%)`}
              >
                {data?.cohortData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Geographic Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Users by Country
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data?.usersByCountry}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="country"
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Retention Cohorts */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Retention Cohorts
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data?.retentionCohorts}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="cohort" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="day1" stroke="#3b82f6" name="Day 1" />
            <Line type="monotone" dataKey="day7" stroke="#10b981" name="Day 7" />
            <Line type="monotone" dataKey="day30" stroke="#f59e0b" name="Day 30" />
            <Line type="monotone" dataKey="day90" stroke="#ef4444" name="Day 90" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Device Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Device Usage
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {data?.deviceBreakdown.map((device) => {
            const percentage = ((device.count / data.totalUsers) * 100).toFixed(1)
            return (
              <div key={device.device} className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {percentage}%
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {device.device}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {formatNumber(device.count)} users
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}