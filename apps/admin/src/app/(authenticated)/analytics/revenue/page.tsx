'use client'

import { useEffect, useState } from 'react'
import { MetricsCard } from '@/components/MetricsCard'
import { RevenueChart } from '@/components/charts/RevenueChart'
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  Users,
  RefreshCw,
  Download,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { toast } from 'sonner'

interface RevenueData {
  mrr: number
  arr: number
  churnRate: number
  totalRevenue: number
  revenueByPeriod: Array<{ date: string; amount: number }>
  growth: number
  topSources: Array<{
    seller_id: string
    sellers: { name: string }
    amount: number
  }>
  revenueByTier: Array<{
    tier: string
    revenue: number
    count: number
  }>
  ltv: number
  arpu: number
  paymentMethods: Array<{
    method: string
    count: number
    total: number
  }>
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState('30d')
  const [chartType, setChartType] = useState<'area' | 'line' | 'bar'>('area')

  useEffect(() => {
    fetchRevenueData()
  }, [period])

  const fetchRevenueData = async () => {
    try {
      // Simulated data for now
      const mockData: RevenueData = {
        mrr: 45000,
        arr: 540000,
        churnRate: 5.2,
        totalRevenue: 125000,
        growth: 12.5,
        ltv: 450,
        arpu: 25,
        revenueByPeriod: generateMockRevenuePeriodData(period),
        topSources: [
          { seller_id: '1', sellers: { name: 'Top Creator 1' }, amount: 25000 },
          { seller_id: '2', sellers: { name: 'Top Creator 2' }, amount: 18000 },
          { seller_id: '3', sellers: { name: 'Top Creator 3' }, amount: 15000 },
          { seller_id: '4', sellers: { name: 'Top Creator 4' }, amount: 12000 },
          { seller_id: '5', sellers: { name: 'Top Creator 5' }, amount: 10000 },
        ],
        revenueByTier: [
          { tier: 'Free', revenue: 0, count: 5000 },
          { tier: 'Basic', revenue: 15000, count: 1500 },
          { tier: 'Pro', revenue: 20000, count: 800 },
          { tier: 'Enterprise', revenue: 10000, count: 100 },
        ],
        paymentMethods: [
          { method: 'Credit Card', count: 2000, total: 35000 },
          { method: 'PayPal', count: 500, total: 8000 },
          { method: 'Bank Transfer', count: 100, total: 2000 },
        ],
      }
      setData(mockData)
    } catch (error) {
      console.error('Error fetching revenue data:', error)
      toast.error('Failed to load revenue data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const generateMockRevenuePeriodData = (period: string) => {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
    const data = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      data.push({
        date: date.toISOString().split('T')[0],
        amount: Math.floor(Math.random() * 5000) + 2000,
      })
    }

    return data
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchRevenueData()
  }

  const handleExport = async () => {
    toast.success('Revenue report exported')
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Revenue Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track revenue performance and financial metrics
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
          title="Monthly Recurring Revenue"
          value={data ? formatCurrency(data.mrr) : '-'}
          change={data?.growth}
          icon={<DollarSign className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Annual Recurring Revenue"
          value={data ? formatCurrency(data.arr) : '-'}
          subtitle="Based on current MRR"
          icon={<TrendingUp className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="Customer Lifetime Value"
          value={data ? formatCurrency(data.ltv) : '-'}
          subtitle="Average per customer"
          icon={<Users className="h-5 w-5" />}
          loading={loading}
        />
        <MetricsCard
          title="ARPU"
          value={data ? formatCurrency(data.arpu) : '-'}
          subtitle="Average revenue per user"
          icon={<CreditCard className="h-5 w-5" />}
          loading={loading}
        />
      </div>

      {/* Revenue Chart with Controls */}
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setChartType('area')}
            className={`px-3 py-1 rounded ${
              chartType === 'area'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Area
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1 rounded ${
              chartType === 'line'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Line
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1 rounded ${
              chartType === 'bar'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Bar
          </button>
        </div>
        {data && <RevenueChart data={data.revenueByPeriod} type={chartType} height={400} />}
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Tier */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Revenue by Subscription Tier
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data?.revenueByTier.filter(t => t.revenue > 0)}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="revenue"
                label={({ tier, percent }: any) => `${tier} ${((percent as number) * 100).toFixed(0)}%`}
              >
                {data?.revenueByTier.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Revenue Sources */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Revenue Sources
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data?.topSources}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="sellers.name"
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="amount" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Payment Methods Distribution
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Payment Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Transactions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Avg Transaction
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data?.paymentMethods.map((method) => (
                <tr key={method.method}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {method.method}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {method.count.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatCurrency(method.total)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatCurrency(method.total / method.count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}