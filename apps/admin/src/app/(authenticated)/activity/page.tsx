'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Filter, RefreshCcw, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

type ActivityLog = {
  id: string
  admin_id: string
  action: string
  entity_type: string
  entity_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  metadata?: Record<string, any> | null
  created_at: string
  admin?: {
    id: string
    full_name?: string | null
    email?: string | null
  } | null
}

type Filters = {
  action: string
  adminId: string
  startDate: string
  endDate: string
  limit: number
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [adminOptions, setAdminOptions] = useState<Array<{ id: string; label: string }>>([])
  const [filters, setFilters] = useState<Filters>({
    action: '',
    adminId: 'all',
    startDate: '',
    endDate: '',
    limit: 50,
  })

  const fetchLogs = useCallback(
    async (override?: Partial<Filters>) => {
      const nextFilters = { ...filters, ...override }
      setLoading(true)

      try {
        const params = new URLSearchParams()
        params.set('limit', String(nextFilters.limit))
        if (nextFilters.action) params.set('action', nextFilters.action)
        if (nextFilters.adminId && nextFilters.adminId !== 'all') params.set('adminId', nextFilters.adminId)
        if (nextFilters.startDate) params.set('start', new Date(nextFilters.startDate).toISOString())
        if (nextFilters.endDate) params.set('end', new Date(nextFilters.endDate).toISOString())

        const response = await fetch(`/api/admin/activity?${params.toString()}`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error || 'Failed to load activity log')
        }

        const payload = await response.json()
        setLogs(payload.logs || [])
        setFilters(nextFilters)

        const uniqueAdmins = Array.from(
          new Map(
            (payload.logs || [])
              .filter((log: ActivityLog) => log.admin?.id)
              .map((log: ActivityLog) => [
                log.admin!.id,
                {
                  id: log.admin!.id,
                  label: log.admin?.full_name || log.admin?.email || log.admin!.id,
                },
              ])
          ).values()
        )
        setAdminOptions(uniqueAdmins)
      } catch (error) {
        console.error(error)
        toast.error('Unable to fetch activity log', {
          description: error instanceof Error ? error.message : undefined,
        })
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    },
    [filters]
  )

  useEffect(() => {
    fetchLogs()
  }, [])

  const refreshLogs = () => {
    setIsRefreshing(true)
    fetchLogs()
  }

  const filteredLogs = useMemo(() => logs, [logs])

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="h-8 w-8" />
            Activity Log
          </h1>
          <p className="text-gray-600 mt-2">Track administrative actions performed across the platform.</p>
        </div>
        <button
          onClick={refreshLogs}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 rounded-lg border px-4 py-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Filter by action"
              value={filters.action}
              onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value }))}
              className="w-full focus:outline-none"
            />
          </div>
          <select
            value={filters.adminId}
            onChange={(event) => setFilters((prev) => ({ ...prev, adminId: event.target.value }))}
            className="rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All admins</option>
            {adminOptions.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, startDate: event.target.value }))}
            className="rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => setFilters((prev) => ({ ...prev, endDate: event.target.value }))}
            className="rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filters.limit}
            onChange={(event) => setFilters((prev) => ({ ...prev, limit: Number(event.target.value) }))}
            className="rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[25, 50, 100, 200].map((value) => (
              <option key={value} value={value}>
                {value} rows
              </option>
            ))}
          </select>
          <button
            onClick={() => fetchLogs()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply Filters
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading activity log…</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No activity recorded for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Admin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Metadata</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Network</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      <div className="flex flex-col">
                        <span>{log.admin?.full_name || log.admin?.email || 'Unknown admin'}</span>
                        <span className="text-xs text-gray-500">{log.admin?.email || log.admin_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      <div className="flex flex-col">
                        <span className="font-medium">{log.entity_type}</span>
                        {log.entity_id && <span className="text-xs text-gray-500">{log.entity_id}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <pre className="whitespace-pre-wrap rounded bg-gray-100 p-2 text-[11px] leading-4">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      <div className="flex flex-col">
                        <span>{log.ip_address || '—'}</span>
                        <span className="text-[11px] text-gray-400 truncate max-w-xs">{log.user_agent || ''}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">
                      <div className="flex flex-col">
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
