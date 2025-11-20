'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Flag,
  Eye,
  ChevronRight,
  Filter,
  RefreshCw,
  Users,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { toast } from 'sonner'

interface ContentReport {
  id: string
  content_type: string
  content_id: string
  category: string
  description?: string
  status: 'pending' | 'under_review' | 'actioned' | 'dismissed'
  priority_score: number
  created_at: string
  reporter?: {
    id?: string
    email?: string
    display_name?: string
  }
  similar_reports_count?: number
}

const CATEGORY_LABELS: Record<string, string> = {
  inappropriate_content: 'Inappropriate Content',
  offensive_language: 'Offensive Language',
  copyright_violation: 'Copyright Violation',
  spam: 'Spam',
  scam_fraud: 'Scam or Fraud',
  misleading_content: 'Misleading Content',
  harassment: 'Harassment',
  other: 'Other',
}

export default function ModerationQueuePage() {
  const [reports, setReports] = useState<ContentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState<string>('pending')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set())
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    fetchReports()

    const supabase = createClient()
    const subscription = supabase
      .channel('moderation_queue')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_reports',
        },
        () => {
          fetchReports()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [selectedStatus, selectedCategory])

  const fetchReports = async () => {
    setLoading(true)

    try {
      const params = new URLSearchParams()
      if (selectedStatus) params.set('status', selectedStatus)
      if (selectedCategory) params.set('category', selectedCategory)

      const response = await fetch(`/api/moderation/queue?${params.toString()}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('Failed to load moderation queue')
      }

      const data = await response.json()
      setReports(data.reports || [])
    } catch (error) {
      console.error('Error fetching reports:', error)
      toast.error('Failed to load moderation queue')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchReports()
  }

  const handleBulkDismiss = async () => {
    if (selectedReports.size === 0) {
      toast.error('Please select reports to dismiss')
      return
    }

    try {
      const response = await fetch('/api/moderation/queue/bulk-dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedReports) }),
      })

      if (!response.ok) {
        throw new Error('Failed to dismiss reports')
      }

      toast.success(`Dismissed ${selectedReports.size} reports`)
      setSelectedReports(new Set())
      fetchReports()
    } catch (error) {
      console.error('Error dismissing reports:', error)
      toast.error('Failed to dismiss reports')
    }
  }

  const getPriorityColor = (score: number) => {
    if (score >= 75) return 'text-red-600 bg-red-50 border-red-200'
    if (score >= 50) return 'text-orange-600 bg-orange-50 border-orange-200'
    if (score >= 25) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-gray-600 bg-gray-50 border-gray-200'
  }

  const getPriorityLabel = (score: number) => {
    if (score >= 75) return 'Critical'
    if (score >= 50) return 'High'
    if (score >= 25) return 'Medium'
    return 'Low'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'actioned':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'dismissed':
        return <XCircle className="h-5 w-5 text-gray-500" />
      case 'under_review':
        return <Clock className="h-5 w-5 text-yellow-500" />
      default:
        return <AlertTriangle className="h-5 w-5 text-orange-500" />
    }
  }

  const stats = {
    pending: reports.filter(r => r.status === 'pending').length,
    under_review: reports.filter(r => r.status === 'under_review').length,
    critical: reports.filter(r => r.priority_score >= 75).length,
    total: reports.length,
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="h-8 w-8" />
              Moderation Queue
            </h1>
            <p className="text-gray-600 mt-2">
              Review reported content from users
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Pending Review</div>
              <div className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending}</div>
            </div>
            <Clock className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Under Review</div>
              <div className="text-3xl font-bold text-blue-600 mt-2">{stats.under_review}</div>
            </div>
            <Eye className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Critical Priority</div>
              <div className="text-3xl font-bold text-red-600 mt-2">{stats.critical}</div>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-600">Total Reports</div>
              <div className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</div>
            </div>
            <Flag className="h-8 w-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Filter className="h-5 w-5 text-gray-500" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="actioned">Actioned</option>
                <option value="dismissed">Dismissed</option>
              </select>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            {selectedReports.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {selectedReports.size} selected
                </span>
                <button
                  onClick={handleBulkDismiss}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Bulk Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Loading reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No reports to review</p>
            <p className="text-sm text-gray-500 mt-2">
              Reports from users will appear here
            </p>
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedReports.has(report.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedReports)
                        if (e.target.checked) {
                          newSelected.add(report.id)
                        } else {
                          newSelected.delete(report.id)
                        }
                        setSelectedReports(newSelected)
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(report.status)}
                        <span className="font-semibold text-gray-900">
                          {report.content_type.charAt(0).toUpperCase() + report.content_type.slice(1).replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(report.priority_score)}`}>
                          {getPriorityLabel(report.priority_score)} Priority ({report.priority_score})
                        </span>
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          {CATEGORY_LABELS[report.category] || report.category}
                        </span>
                        {report.similar_reports_count && report.similar_reports_count > 1 && (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                            <Users className="h-3 w-3" />
                            {report.similar_reports_count} reports
                          </span>
                        )}
                      </div>

                      {report.description && (
                        <p className="text-gray-600 mb-3">{report.description}</p>
                      )}

                      <div className="flex items-center gap-6 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <span>Reported by:</span>
                          <span className="font-medium">
                            {report.reporter?.display_name || report.reporter?.email || 'unknown'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/moderation/review/${report.id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Review
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
