'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Music,
  Search,
  Edit,
  Trash2,
  Plus,
  RefreshCcw,
  Loader2,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Filter,
  Activity,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

type LicensingInfo = {
  license_type?: string
  license_provider?: string
  expiry_date?: string | null
  territory?: string[]
  attribution_required?: boolean
}

type BackgroundTrack = {
  id: string
  title: string
  artist?: string | null
  url: string
  price_cents: number
  duration_seconds?: number | null
  is_platform_asset: boolean
  is_stereo: boolean
  is_active: boolean
  license_note?: string | null
  tags?: string[] | null
  category?: string | null
  mood?: string | null
  genre?: string | null
  created_at: string
  updated_at: string
  track_licensing?: LicensingInfo | null
}

type TrackUsageStat = {
  id: string
  title: string
  usage_count?: number | null
  license_type?: string | null
  expiry_date?: string | null
  status?: 'active' | 'expiring_soon' | 'expired' | 'usage_limit_reached' | 'inactive'
  is_platform_asset?: boolean
  category?: string | null
  mood?: string | null
}

type TrackUpdatePayload = {
  id: string
  title: string
  artist?: string
  price_cents: number
  tags: string[]
  category?: string
  mood?: string
  genre?: string
  license_note?: string
  is_platform_asset: boolean
  is_stereo: boolean
  is_active: boolean
  licensing?: LicensingInfo
}

const PAGE_SIZE = 20
const CATEGORIES = [
  'meditation',
  'focus',
  'nature',
  'binaural',
  'solfeggio',
  'ambient',
  'sleep',
  'healing',
]
const MOODS = [
  'peaceful',
  'calming',
  'focused',
  'energizing',
  'neutral',
  'uplifting',
  'restorative',
]

export default function CatalogPage() {
  const [tracks, setTracks] = useState<BackgroundTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'platform' | 'user'>('all')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedMood, setSelectedMood] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<BackgroundTrack | null>(null)
  const [mutatingTrackId, setMutatingTrackId] = useState<string | null>(null)
  const [savingTrackId, setSavingTrackId] = useState<string | null>(null)
  const [usageStats, setUsageStats] = useState<TrackUsageStat[]>([])
  const initialLoad = useRef(true)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchTerm), 400)
    return () => clearTimeout(timeout)
  }, [searchTerm])

  const loadTracks = useCallback(
    async ({ withLoader = false }: { withLoader?: boolean } = {}) => {
        if (withLoader) {
          setLoading(true)
        } else {
          setIsRefreshing(true)
        }

        try {
          const params = new URLSearchParams({
            page: String(page),
            limit: String(PAGE_SIZE),
          })
          if (debouncedSearch) params.set('search', debouncedSearch)
          if (selectedTag) params.set('tag', selectedTag)
          if (statusFilter !== 'all') params.set('is_active', statusFilter === 'active' ? 'true' : 'false')
          if (typeFilter !== 'all') params.set('is_platform', typeFilter === 'platform' ? 'true' : 'false')
          if (selectedCategory) params.set('category', selectedCategory)
          if (selectedMood) params.set('mood', selectedMood)

          const response = await fetch(`/api/catalog?${params.toString()}`)
          if (!response.ok) {
            throw new Error('Failed to load catalog data')
          }

          const data = await response.json()
          setTracks(data.tracks || [])
          setUsageStats(data.stats || [])
          setPagination(data.pagination || { page: 1, pages: 1, total: data.tracks?.length || 0 })
        } catch (error) {
          console.error('Error fetching tracks:', error)
          toast.error('Unable to load catalog', {
            description: error instanceof Error ? error.message : undefined,
          })
        } finally {
          if (withLoader) {
            setLoading(false)
          } else {
            setIsRefreshing(false)
          }
        }
      },
    [page, debouncedSearch, selectedTag, statusFilter, typeFilter, selectedCategory, selectedMood]
  )

  useEffect(() => {
    loadTracks({ withLoader: initialLoad.current })
    if (initialLoad.current) {
      initialLoad.current = false
    }
  }, [loadTracks])

  const availableTags = useMemo(() => {
    const tags = tracks.flatMap((track) => track.tags || [])
    return Array.from(new Set(tags))
  }, [tracks])

  const tagOptions = useMemo(() => {
    const set = new Set(availableTags)
    if (selectedTag && !set.has(selectedTag)) {
      set.add(selectedTag)
    }
    return Array.from(set)
  }, [availableTags, selectedTag])

  const catalogMetrics = useMemo(() => {
    const total = tracks.length
    const platform = tracks.filter((track) => track.is_platform_asset).length
    const active = tracks.filter((track) => track.is_active).length
    const avgPrice =
      total === 0 ? 0 : tracks.reduce((sum, track) => sum + track.price_cents, 0) / total / 100
    return {
      total,
      platform,
      active,
      avgPrice: avgPrice.toFixed(2),
    }
  }, [tracks])

  const usageSummary = useMemo(() => {
    const totalPlays = usageStats.reduce((sum, stat) => sum + (stat.usage_count ?? 0), 0)
    const expiringSoon = usageStats.filter((stat) => stat.status === 'expiring_soon')
    const expired = usageStats.filter((stat) => stat.status === 'expired')
    const inactive = usageStats.filter((stat) => stat.status === 'inactive')
    const usageLimit = usageStats.filter((stat) => stat.status === 'usage_limit_reached')

    return {
      totalPlays,
      expiringSoon,
      expired,
      inactive,
      usageLimit,
    }
  }, [usageStats])

  const licensingAlerts = useMemo(() => {
    const alerts = usageStats.filter(
      (stat) => stat.status === 'expired' || stat.status === 'expiring_soon'
    )
    const toTime = (value?: string | null) => {
      if (!value) return Number.MAX_SAFE_INTEGER
      const time = new Date(value).getTime()
      return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time
    }
    return alerts.sort((a, b) => toTime(a.expiry_date) - toTime(b.expiry_date)).slice(0, 5)
  }, [usageStats])

  const topUsageTracks = useMemo(() => {
    return usageStats
      .filter((stat) => (stat.usage_count ?? 0) > 0)
      .sort((a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0))
      .slice(0, 5)
  }, [usageStats])

  const handleDeleteTrack = async (track: BackgroundTrack) => {
    const confirmDelete = window.confirm(`Delete "${track.title}" from the catalog?`)
    if (!confirmDelete) return

    setMutatingTrackId(track.id)
    try {
      const response = await fetch(`/api/catalog?id=${track.id}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error('Failed to delete track')
      }
      toast.success('Track deleted')
      await loadTracks()
    } catch (error) {
      console.error('Error deleting track:', error)
      toast.error('Unable to delete track', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setMutatingTrackId(null)
    }
  }

  const handleToggleActive = async (track: BackgroundTrack) => {
    setMutatingTrackId(track.id)
    try {
      const response = await fetch('/api/catalog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: track.id,
          is_active: !track.is_active,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update track status')
      }

      toast.success(`Track ${track.is_active ? 'disabled' : 'activated'}`)
      await loadTracks()
    } catch (error) {
      console.error('Error updating track status:', error)
      toast.error('Unable to update track status', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setMutatingTrackId(null)
    }
  }

  const handleTrackSave = async (payload: TrackUpdatePayload) => {
    setSavingTrackId(payload.id)
    try {
      const response = await fetch('/api/catalog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Failed to save track changes')
      }

      toast.success('Track updated')
      setShowEditModal(false)
      setSelectedTrack(null)
      await loadTracks()
    } catch (error) {
      console.error('Error saving track:', error)
      toast.error('Unable to save track', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setSavingTrackId(null)
    }
  }

  const handleUploadComplete = async () => {
    setShowUploadModal(false)
    await loadTracks()
  }

  const handleRefresh = () => loadTracks()

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-gray-500" />
      </div>
    )
  }

  const totalPages = pagination.pages || 1
  const isFirstPage = page <= 1
  const isLastPage = page >= totalPages

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Music className="h-8 w-8" />
            Music Catalog
          </h1>
          <p className="text-gray-600 mt-1">Manage platform background tracks and licensing</p>
          {isRefreshing && (
            <div className="flex items-center gap-2 text-sm text-blue-600 mt-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing latest data...
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Track
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Total Tracks</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{catalogMetrics.total}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            Platform Assets
          </div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{catalogMetrics.platform}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Active Tracks
          </div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{catalogMetrics.active}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Avg Price</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">${catalogMetrics.avgPrice}</div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-gray-700 font-semibold mb-4">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search title or artist"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                if (page !== 1) setPage(1)
              }}
              className="w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedTag}
            onChange={(e) => {
              setSelectedTag(e.target.value)
              if (page !== 1) setPage(1)
            }}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Tags</option>
            {tagOptions.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
              if (page !== 1) setPage(1)
            }}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as 'all' | 'platform' | 'user')
              if (page !== 1) setPage(1)
            }}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="platform">Platform</option>
            <option value="user">Creator Uploads</option>
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value)
              if (page !== 1) setPage(1)
            }}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            value={selectedMood}
            onChange={(e) => {
              setSelectedMood(e.target.value)
              if (page !== 1) setPage(1)
            }}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Moods</option>
            {MOODS.map((mood) => (
              <option key={mood} value={mood}>
                {mood}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={() => {
              setSearchTerm('')
              setSelectedTag('')
              setStatusFilter('all')
              setTypeFilter('all')
              setSelectedCategory('')
              setSelectedMood('')
              if (page !== 1) setPage(1)
            }}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Clear filters
          </button>
        </div>
      </div>

      {usageStats.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500">Total Plays (lifetime)</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {usageSummary.totalPlays.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-2">Across all rendered mixes</p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Expiring Soon
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {usageSummary.expiringSoon.length}
              </p>
              <p className="text-xs text-gray-500 mt-2">Within 30 days</p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Expired Licenses
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {usageSummary.expired.length}
              </p>
              <p className="text-xs text-gray-500 mt-2">Require immediate action</p>
            </div>
            <div className="bg-white border rounded-lg p-4">
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-500" />
                Usage Limits / Inactive
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {usageSummary.usageLimit.length + usageSummary.inactive.length}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Tracks paused automatically or manually
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white border rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Licensing Alerts</h3>
                  <p className="text-sm text-gray-500">
                    {usageSummary.expiringSoon.length + usageSummary.expired.length} tracks need follow-up
                  </p>
                </div>
              </div>
              {licensingAlerts.length === 0 ? (
                <p className="text-sm text-gray-500">No upcoming expirations. All clear.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {licensingAlerts.map((alert) => {
                    const expiryLabel = alert.expiry_date
                      ? `Expires ${formatDistanceToNow(new Date(alert.expiry_date), { addSuffix: true })}`
                      : 'No expiry on file'
                    const badgeClasses =
                      alert.status === 'expired'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    const badgeLabel = alert.status === 'expired' ? 'Expired' : 'Expiring soon'

                    return (
                      <li key={alert.id} className="py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                            <p className="text-xs text-gray-500">{expiryLabel}</p>
                            {alert.license_type && (
                              <p className="text-xs text-gray-400 mt-1">License: {alert.license_type}</p>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClasses}`}>
                            {badgeLabel}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="bg-white border rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Top Performing Tracks</h3>
                  <p className="text-sm text-gray-500">Highest lifetime playback counts</p>
                </div>
              </div>
              {topUsageTracks.length === 0 ? (
                <p className="text-sm text-gray-500">No playback data yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {topUsageTracks.map((stat, index) => (
                    <li key={stat.id} className="py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {index + 1}. {stat.title}
                          </p>
                          {stat.license_type && (
                            <p className="text-xs text-gray-500">License: {stat.license_type}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">
                            {(stat.usage_count ?? 0).toLocaleString()} plays
                          </p>
                          {stat.status && (
                            <p className="text-xs text-gray-500 capitalize">{stat.status.replace(/_/g, ' ')}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        {tracks.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No tracks match the current filters.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Track
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pricing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  License
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Added
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tracks.map((track) => {
                const license = track.track_licensing
                const expiryDate = license?.expiry_date ? new Date(license.expiry_date) : null
                const now = Date.now()
                const expiringSoon =
                  expiryDate && expiryDate.getTime() > now && expiryDate.getTime() - now < 1000 * 60 * 60 * 24 * 30
                const expired = expiryDate ? expiryDate.getTime() < now : false
                const isMutating = mutatingTrackId === track.id

                return (
                  <tr key={track.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="text-sm font-semibold text-gray-900">{track.title}</div>
                        <div className="text-xs text-gray-500 space-x-2">
                          {track.artist && <span>{track.artist}</span>}
                          {track.category && <span>• {track.category}</span>}
                          {track.mood && <span>• {track.mood}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(track.tags || []).map((tag) => (
                            <span
                              key={`${track.id}-${tag}`}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <a
                          href={track.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                        >
                          Preview
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      ${(track.price_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            track.is_platform_asset ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {track.is_platform_asset ? 'Platform' : 'Creator'}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            track.is_stereo ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {track.is_stereo ? 'Stereo' : 'Mono'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 flex items-center gap-2">
                        {license?.license_type || 'N/A'}
                        {expired && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        {expiringSoon && !expired && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                        {!expired && !expiringSoon && license?.license_type && (
                          <ShieldCheck className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      {license?.expiry_date && (
                        <div className={`text-xs ${expired ? 'text-red-600' : expiringSoon ? 'text-yellow-600' : 'text-gray-500'}`}>
                          Expires {new Date(license.expiry_date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          track.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {track.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDistanceToNow(new Date(track.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedTrack(track)
                            setShowEditModal(true)
                          }}
                          className="p-2 rounded hover:bg-gray-100 text-gray-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(track)}
                          disabled={isMutating}
                          className={`p-2 rounded ${
                            track.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-500 hover:bg-gray-100'
                          } ${isMutating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {track.is_active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                        </button>
                        <button
                          onClick={() => handleDeleteTrack(track)}
                          disabled={isMutating}
                          className={`p-2 rounded text-red-600 hover:bg-red-50 ${
                            isMutating ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-6">
        <div className="text-sm text-gray-500">
          Showing {tracks.length} of {pagination.total} tracks
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={isFirstPage}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={isLastPage}
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      <UploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploaded={handleUploadComplete}
      />

      <EditTrackModal
        open={showEditModal}
        track={selectedTrack}
        onClose={() => {
          setShowEditModal(false)
          setSelectedTrack(null)
        }}
        onSave={handleTrackSave}
        saving={savingTrackId === selectedTrack?.id}
      />
    </div>
  )
}

function UploadModal({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean
  onClose: () => void
  onUploaded: () => Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [price, setPrice] = useState('3.00')
  const [tags, setTags] = useState('')
  const [category, setCategory] = useState('')
  const [mood, setMood] = useState('')
  const [licenseNote, setLicenseNote] = useState('')
  const [isPlatformAsset, setIsPlatformAsset] = useState(true)
  const [isStereo, setIsStereo] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!open) {
      setFile(null)
      setTitle('')
      setArtist('')
      setPrice('3.00')
      setTags('')
      setCategory('')
      setMood('')
      setLicenseNote('')
      setIsPlatformAsset(true)
      setIsStereo(true)
    }
  }, [open])

  if (!open) {
    return null
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select an audio file to upload')
      return
    }

    if (!title.trim()) {
      toast.error('Track title is required')
      return
    }

    const priceValue = parseFloat(price || '0')
    if (Number.isNaN(priceValue)) {
      toast.error('Please enter a valid price')
      return
    }

    setUploading(true)
    try {
      const metadata = {
        title: title.trim(),
        artist: artist.trim() || undefined,
        price_cents: Math.round(priceValue * 100),
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        category: category || undefined,
        mood: mood || undefined,
        license_note: licenseNote.trim() || undefined,
        is_platform_asset: isPlatformAsset,
        is_stereo: isStereo,
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('metadata', JSON.stringify(metadata))

      const response = await fetch('/api/catalog/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const details = await response.json().catch(() => null)
        throw new Error(details?.error || 'Upload failed')
      }

      toast.success('Track uploaded')
      await onUploaded()
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Unable to upload track', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-full overflow-y-auto">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Upload New Track</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            ×
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Audio File</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Supported formats: mp3, wav, ogg, m4a (max 50MB)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Artist</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (USD)</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <input
                type="text"
                value={tags}
                placeholder="calm, piano, forest"
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select category</option>
                {CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mood</label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select mood</option>
                {MOODS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Notes</label>
            <textarea
              value={licenseNote}
              onChange={(e) => setLicenseNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isPlatformAsset}
                onChange={(e) => setIsPlatformAsset(e.target.checked)}
                className="rounded"
              />
              Platform asset
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isStereo}
                onChange={(e) => setIsStereo(e.target.checked)}
                className="rounded"
              />
              Stereo mix
            </label>
          </div>
        </div>
        <div className="border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload Track'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditTrackModal({
  open,
  track,
  onClose,
  onSave,
  saving,
}: {
  open: boolean
  track: BackgroundTrack | null
  onClose: () => void
  onSave: (payload: TrackUpdatePayload) => Promise<void>
  saving: boolean
}) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [price, setPrice] = useState('0')
  const [tags, setTags] = useState('')
  const [category, setCategory] = useState('')
  const [mood, setMood] = useState('')
  const [genre, setGenre] = useState('')
  const [licenseNote, setLicenseNote] = useState('')
  const [isPlatformAsset, setIsPlatformAsset] = useState(true)
  const [isStereo, setIsStereo] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [licenseType, setLicenseType] = useState('')
  const [licenseProvider, setLicenseProvider] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [territory, setTerritory] = useState('')
  const [requiresAttribution, setRequiresAttribution] = useState(false)

  useEffect(() => {
    if (track && open) {
      setTitle(track.title || '')
      setArtist(track.artist || '')
      setPrice(((track.price_cents || 0) / 100).toFixed(2))
      setTags((track.tags || []).join(', '))
      setCategory(track.category || '')
      setMood(track.mood || '')
      setGenre(track.genre || '')
      setLicenseNote(track.license_note || '')
      setIsPlatformAsset(track.is_platform_asset)
      setIsStereo(track.is_stereo)
      setIsActive(track.is_active)
      setLicenseType(track.track_licensing?.license_type || '')
      setLicenseProvider(track.track_licensing?.license_provider || '')
      setExpiryDate(
        track.track_licensing?.expiry_date
          ? new Date(track.track_licensing.expiry_date).toISOString().split('T')[0]
          : ''
      )
      setTerritory((track.track_licensing?.territory || []).join(', '))
      setRequiresAttribution(Boolean(track.track_licensing?.attribution_required))
    }
  }, [track, open])

  if (!open || !track) {
    return null
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Track title is required')
      return
    }

    const priceValue = parseFloat(price || '0')
    if (Number.isNaN(priceValue)) {
      toast.error('Please enter a valid price')
      return
    }

    const payload: TrackUpdatePayload = {
      id: track.id,
      title: title.trim(),
      artist: artist.trim() || undefined,
      price_cents: Math.round(priceValue * 100),
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      category: category || undefined,
      mood: mood || undefined,
      genre: genre || undefined,
      license_note: licenseNote.trim() || undefined,
      is_platform_asset: isPlatformAsset,
      is_stereo: isStereo,
      is_active: isActive,
    }

    if (
      licenseType ||
      licenseProvider ||
      expiryDate ||
      territory ||
      requiresAttribution
    ) {
      payload.licensing = {
        license_type: licenseType || undefined,
        license_provider: licenseProvider || undefined,
        expiry_date: expiryDate || null,
        territory: territory
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
        attribution_required: requiresAttribution,
      }
    }

    await onSave(payload)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-full overflow-y-auto">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Edit Track</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Artist</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (USD)</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select category</option>
                {CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mood</label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select mood</option>
                {MOODS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Note</label>
            <textarea
              value={licenseNote}
              onChange={(e) => setLicenseNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Type</label>
              <input
                type="text"
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="royalty_free"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Provider</label>
              <input
                type="text"
                value={licenseProvider}
                onChange={(e) => setLicenseProvider(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Territory</label>
              <input
                type="text"
                value={territory}
                onChange={(e) => setTerritory(e.target.value)}
                placeholder="worldwide, US-only"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={requiresAttribution}
                onChange={(e) => setRequiresAttribution(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Attribution required</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isPlatformAsset}
                onChange={(e) => setIsPlatformAsset(e.target.checked)}
                className="rounded"
              />
              Platform asset
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isStereo}
                onChange={(e) => setIsStereo(e.target.checked)}
                className="rounded"
              />
              Stereo mix
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              Active
            </label>
          </div>
        </div>

        <div className="border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
