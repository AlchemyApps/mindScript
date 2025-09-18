'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingCart, CheckCircle, XCircle, AlertCircle, DollarSign, User, TrendingUp, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Seller {
  id: string
  profile_id: string
  accepted_at: string
  stripe_connect_id?: string
  status: 'pending' | 'active' | 'suspended' | 'rejected'
  onboarding_complete: boolean
  created_at: string
  updated_at: string
  profile?: {
    email: string
    full_name?: string
    display_name?: string
  }
  earnings?: {
    total: number
    pending: number
    paid: number
  }
  tracks_count?: number
}

export default function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    totalRevenue: 0,
  })

  useEffect(() => {
    fetchSellers()
  }, [])

  async function fetchSellers() {
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('seller_agreements')
        .select(`
          *,
          profile:profiles(email, full_name, display_name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Mock earnings data for now
      const sellersWithEarnings = (data || []).map(seller => ({
        ...seller,
        earnings: {
          total: Math.floor(Math.random() * 10000),
          pending: Math.floor(Math.random() * 1000),
          paid: Math.floor(Math.random() * 9000),
        },
        tracks_count: Math.floor(Math.random() * 50),
      }))

      setSellers(sellersWithEarnings)

      // Calculate stats
      const stats = sellersWithEarnings.reduce(
        (acc, seller) => ({
          total: acc.total + 1,
          active: acc.active + (seller.status === 'active' ? 1 : 0),
          pending: acc.pending + (seller.status === 'pending' ? 1 : 0),
          totalRevenue: acc.totalRevenue + (seller.earnings?.total || 0),
        }),
        { total: 0, active: 0, pending: 0, totalRevenue: 0 }
      )
      setStats(stats)
    } catch (error) {
      console.error('Error fetching sellers:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSellers = sellers.filter(seller => {
    const matchesStatus = selectedStatus === 'all' || seller.status === selectedStatus
    const matchesSearch =
      seller.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seller.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seller.profile?.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const getStatusBadge = (status: string) => {
    const badges = {
      active: { icon: CheckCircle, color: 'bg-green-100 text-green-800' },
      pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
      suspended: { icon: XCircle, color: 'bg-red-100 text-red-800' },
      rejected: { icon: XCircle, color: 'bg-gray-100 text-gray-800' },
    }
    const badge = badges[status as keyof typeof badges] || badges.pending
    const Icon = badge.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <ShoppingCart className="h-8 w-8" />
          Seller Management
        </h1>
        <p className="text-gray-600 mt-2">
          Manage marketplace sellers, KYC status, and payouts
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Total Sellers</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</div>
            </div>
            <User className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Active Sellers</div>
              <div className="text-3xl font-bold text-green-600 mt-2">{stats.active}</div>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Pending KYC</div>
              <div className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending}</div>
            </div>
            <AlertCircle className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Total Revenue</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">
                ${(stats.totalRevenue / 100).toLocaleString()}
              </div>
            </div>
            <DollarSign className="h-8 w-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>

          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Export CSV
          </button>
        </div>
      </div>

      {/* Sellers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Loading sellers...</p>
          </div>
        ) : filteredSellers.length === 0 ? (
          <div className="p-8 text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No sellers found</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seller
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  KYC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tracks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Earnings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSellers.map((seller) => (
                <tr key={seller.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {seller.profile?.display_name || seller.profile?.full_name || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">{seller.profile?.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(seller.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      seller.onboarding_complete
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {seller.onboarding_complete ? 'Complete' : 'Incomplete'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{seller.tracks_count || 0}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        ${((seller.earnings?.total || 0) / 100).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        ${((seller.earnings?.pending || 0) / 100).toLocaleString()} pending
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDistanceToNow(new Date(seller.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button className="text-indigo-600 hover:text-indigo-900">
                        View
                      </button>
                      {seller.status === 'active' ? (
                        <button className="text-red-600 hover:text-red-900">
                          Suspend
                        </button>
                      ) : (
                        <button className="text-green-600 hover:text-green-900">
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}