'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ShoppingCart,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  DollarSign,
  User,
  RefreshCcw,
  Filter,
  Link2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

type SellerStatus = 'pending' | 'active' | 'suspended' | 'rejected'

interface Seller {
  id: string
  user_id: string
  status: SellerStatus
  country?: string | null
  stripe_connect_account_id?: string | null
  charges_enabled: boolean
  payouts_enabled: boolean
  onboarding_completed_at?: string | null
  created_at: string
  updated_at: string
  profile?: {
    email?: string
    full_name?: string
    display_name?: string
  }
  earnings?: {
    total_cents: number
    pending_cents: number
    paid_cents: number
  }
  latest_payout?: {
    amount_cents: number
    status: string
    completed_at?: string | null
  }
  outstanding_payouts?: number
}

interface SellerMetrics {
  total: number
  active: number
  pending: number
  suspended: number
  totalRevenue: number
}

const statusBadge: Record<
  SellerStatus,
  { label: string; color: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  active: { label: 'Active', color: 'text-green-700 bg-green-50', border: 'border-green-200', icon: CheckCircle2 },
  pending: { label: 'Pending', color: 'text-yellow-700 bg-yellow-50', border: 'border-yellow-200', icon: Clock },
  suspended: { label: 'Suspended', color: 'text-red-700 bg-red-50', border: 'border-red-200', icon: XCircle },
  rejected: { label: 'Rejected', color: 'text-gray-700 bg-gray-50', border: 'border-gray-200', icon: XCircle },
}

const currency = (valueCents = 0, code = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 0,
  }).format(valueCents / 100)

export default function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [metrics, setMetrics] = useState<SellerMetrics>({
    total: 0,
    active: 0,
    pending: 0,
    suspended: 0,
    totalRevenue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SellerStatus>('all')
  const [capabilityFilter, setCapabilityFilter] = useState<'all' | 'charges_disabled' | 'payouts_disabled'>('all')

  const loadSellers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/sellers', { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to load sellers')
      const data = await response.json()
      setSellers(data.sellers || [])
      setMetrics(data.metrics || metrics)
    } catch (error) {
      console.error(error)
      toast.error('Unable to fetch sellers')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadSellers()
  }, [loadSellers])

  const filteredSellers = useMemo(() => {
    return sellers.filter((seller) => {
      const matchesStatus = statusFilter === 'all' || seller.status === statusFilter
      const matchesCapability =
        capabilityFilter === 'all' ||
        (capabilityFilter === 'charges_disabled' && !seller.charges_enabled) ||
        (capabilityFilter === 'payouts_disabled' && !seller.payouts_enabled)
      const query = searchTerm.toLowerCase()
      const matchesSearch =
        !query ||
        seller.profile?.email?.toLowerCase().includes(query) ||
        seller.profile?.full_name?.toLowerCase().includes(query) ||
        seller.profile?.display_name?.toLowerCase().includes(query)

      return matchesStatus && matchesCapability && matchesSearch
    })
  }, [sellers, statusFilter, capabilityFilter, searchTerm])

  const handleStatusChange = async (sellerId: string, nextStatus: SellerStatus) => {
    try {
      const response = await fetch(`/api/sellers/${sellerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!response.ok) throw new Error('Update failed')
      toast.success('Seller updated')
      loadSellers()
    } catch (error) {
      console.error(error)
      toast.error('Unable to update seller')
    }
  }

  const handleResendOnboarding = async (sellerId: string) => {
    try {
      const response = await fetch(`/api/sellers/${sellerId}/resend`, { method: 'POST' })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to trigger resend')
      }

      if (payload?.onboardingUrl) {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(payload.onboardingUrl).catch(() => null)
        }

        toast.success('Onboarding link generated', {
          description: 'Link copied to clipboard. Share it with the seller to continue onboarding.',
        })
      } else {
        toast.success(payload?.message || 'Onboarding link sent')
      }
    } catch (error) {
      console.error(error)
      toast.error('Unable to resend onboarding', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ShoppingCart className="h-8 w-8" />
            Seller Management
          </h1>
          <p className="text-gray-600 mt-2">Review onboarding progress, payouts, and compliance</p>
        </div>
        <button
          onClick={() => {
            setIsRefreshing(true)
            loadSellers()
          }}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <MetricCard label="Total Sellers" value={metrics.total} icon={User} />
        <MetricCard label="Active Sellers" value={metrics.active} icon={CheckCircle2} valueClass="text-green-600" />
        <MetricCard label="Pending Review" value={metrics.pending} icon={Clock} valueClass="text-yellow-600" />
        <MetricCard label="Suspended" value={metrics.suspended} icon={AlertTriangle} valueClass="text-red-600" />
        <div className="md:col-span-2 bg-white border rounded-lg p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Lifetime Revenue</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{currency(metrics.totalRevenue)}</p>
            <p className="text-xs text-gray-400 mt-1">Gross revenue attributed to published sellers.</p>
          </div>
          <DollarSign className="h-10 w-10 text-gray-300" />
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-lg border px-4 py-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search sellers…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | SellerStatus)}
            className="rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={capabilityFilter}
            onChange={(event) => setCapabilityFilter(event.target.value as typeof capabilityFilter)}
            className="rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All capabilities</option>
            <option value="charges_disabled">Charges disabled</option>
            <option value="payouts_disabled">Payouts disabled</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="bg-white border rounded-lg p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
            <p className="mt-4 text-gray-500">Loading seller records…</p>
          </div>
        ) : filteredSellers.length === 0 ? (
          <div className="bg-white border rounded-lg p-8 text-center text-gray-500">No sellers match the current filters.</div>
        ) : (
          filteredSellers.map((seller) => (
            <div key={seller.id} className="bg-white border rounded-lg p-6 space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {seller.profile?.display_name || seller.profile?.full_name || seller.profile?.email || 'Unknown seller'}
                  </p>
                  <p className="text-xs text-gray-500">{seller.profile?.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <SellerStatus status={seller.status} />
                    {seller.stripe_connect_account_id && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5">
                        <Link2 className="h-3 w-3" />
                        {seller.stripe_connect_account_id}
                      </span>
                    )}
                    <span>Joined {formatDistanceToNow(new Date(seller.created_at), { addSuffix: true })}</span>
                    {seller.country && <span>{seller.country}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  <CapabilityPill active={seller.charges_enabled} label="Charges" />
                  <CapabilityPill active={seller.payouts_enabled} label="Payouts" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <EarningsCard label="Total earnings" amount={seller.earnings?.total_cents} />
                <EarningsCard label="Pending" amount={seller.earnings?.pending_cents} accent="text-yellow-600" />
                <EarningsCard label="Paid" amount={seller.earnings?.paid_cents} accent="text-green-600" />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleStatusChange(seller.id, seller.status === 'suspended' ? 'active' : 'suspended')}
                  className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {seller.status === 'suspended' ? 'Unsuspend seller' : 'Suspend seller'}
                </button>
                {seller.status === 'pending' && (
                  <button
                    onClick={() => handleStatusChange(seller.id, 'active')}
                    className="rounded-lg border px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                  >
                    Approve seller
                  </button>
                )}
                {seller.status === 'pending' && (
                  <button
                    onClick={() => handleResendOnboarding(seller.id)}
                    className="rounded-lg border px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                  >
                    Resend onboarding link
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
  valueClass,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  valueClass?: string
}) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className={`text-3xl font-bold mt-2 ${valueClass || 'text-gray-900'}`}>{value}</p>
        </div>
        <Icon className="h-8 w-8 text-gray-300" />
      </div>
    </div>
  )
}

function SellerStatus({ status }: { status: SellerStatus }) {
  const config = statusBadge[status]
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color} ${config.border}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}

function CapabilityPill({ active, label }: { active: boolean; label: string }) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        {label} on
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
      <AlertTriangle className="h-3 w-3" />
      {label} off
    </span>
  )
}

function EarningsCard({ label, amount = 0, accent }: { label: string; amount?: number; accent?: string }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-semibold ${accent || 'text-gray-900'}`}>{currency(amount)}</p>
    </div>
  )
}
