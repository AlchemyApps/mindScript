'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft,
  Shield,
  User,
  Clock,
  Flag,
  AlertTriangle,
  History,
  FileText,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ContentReviewer } from '@/components/ContentReviewer'
import { ModerationActions } from '@/components/ModerationActions'
import Link from 'next/link'
import { toast } from 'sonner'

interface Report {
  id: string
  content_type: string
  content_id: string
  category: string
  description?: string
  status: string
  priority_score: number
  created_at: string
  reporter: {
    id: string
    email: string
    display_name?: string
  }
}

interface SimilarReport {
  id: string
  category: string
  description?: string
  created_at: string
  reporter: {
    email: string
    display_name?: string
  }
}

interface UserHistory {
  warnings_count: number
  reports_against: number
  content_removed: number
  last_action?: {
    action_type: string
    reason: string
    created_at: string
  }
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

export default function ModerationReviewPage() {
  const params = useParams()
  const router = useRouter()
  const reportId = params.id as string

  const [report, setReport] = useState<Report | null>(null)
  const [similarReports, setSimilarReports] = useState<SimilarReport[]>([])
  const [userHistory, setUserHistory] = useState<UserHistory | null>(null)
  const [affectedUserId, setAffectedUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (reportId) {
      fetchReportDetails()
    }
  }, [reportId])

  const fetchReportDetails = async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // Fetch main report
      const { data: reportData, error: reportError } = await supabase
        .from('content_reports')
        .select(`
          *,
          reporter:profiles!reporter_id (
            id,
            email,
            display_name
          )
        `)
        .eq('id', reportId)
        .single()

      if (reportError) throw reportError
      setReport(reportData)

      // Fetch similar reports
      const { data: similar } = await supabase
        .from('content_reports')
        .select(`
          id,
          category,
          description,
          created_at,
          reporter:profiles!reporter_id (
            email,
            display_name
          )
        `)
        .eq('content_type', reportData.content_type)
        .eq('content_id', reportData.content_id)
        .neq('id', reportId)
        .order('created_at', { ascending: false })

      setSimilarReports(similar || [])

      // Get affected user ID based on content type
      let userId: string | null = null
      switch (reportData.content_type) {
        case 'track': {
          const { data: track } = await supabase
            .from('tracks')
            .select('user_id')
            .eq('id', reportData.content_id)
            .single()
          userId = track?.user_id || null
          break
        }
        case 'profile': {
          userId = reportData.content_id
          break
        }
        case 'seller_listing': {
          const { data: seller } = await supabase
            .from('seller_profiles')
            .select('user_id')
            .eq('id', reportData.content_id)
            .single()
          userId = seller?.user_id || null
          break
        }
      }

      setAffectedUserId(userId)

      // Fetch user history if we have a user ID
      if (userId) {
        // Count warnings
        const { count: warningsCount } = await supabase
          .from('user_warnings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)

        // Count reports against user's content
        const { count: reportsCount } = await supabase
          .from('content_reports')
          .select('*', { count: 'exact', head: true })
          .eq('content_type', 'track')
          .in('content_id',
            supabase
              .from('tracks')
              .select('id')
              .eq('user_id', userId)
          )

        // Count removed content
        const { count: removedCount } = await supabase
          .from('moderation_actions')
          .select('*', { count: 'exact', head: true })
          .eq('affected_user_id', userId)
          .eq('action_type', 'content_removed')

        // Get last action
        const { data: lastAction } = await supabase
          .from('moderation_actions')
          .select('action_type, reason, created_at')
          .eq('affected_user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        setUserHistory({
          warnings_count: warningsCount || 0,
          reports_against: reportsCount || 0,
          content_removed: removedCount || 0,
          last_action: lastAction || undefined,
        })
      }

    } catch (error) {
      console.error('Error fetching report details:', error)
      toast.error('Failed to load report details')
    } finally {
      setLoading(false)
    }
  }

  const handleActionComplete = () => {
    toast.success('Action completed successfully')
    router.push('/moderation/queue')
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Loading report details...</p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">Report not found</p>
          <Link
            href="/moderation/queue"
            className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to queue
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/moderation/queue"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to queue
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="h-8 w-8" />
          Review Report
        </h1>
        <p className="text-gray-600 mt-2">
          Review the reported content and take appropriate action
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report Details */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Flag className="h-5 w-5" />
              Report Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Category:</span>
                <span className="px-2 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                  {CATEGORY_LABELS[report.category] || report.category}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Priority:</span>
                <span className="font-semibold">{report.priority_score}/100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="capitalize">{report.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Reported:</span>
                <span>{formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}</span>
              </div>
              {report.description && (
                <div className="pt-3 border-t">
                  <p className="text-gray-600 mb-2">Reporter's description:</p>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded">
                    {report.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Content Review */}
          <ContentReviewer
            contentType={report.content_type}
            contentId={report.content_id}
          />

          {/* Moderation Actions */}
          <ModerationActions
            reportId={report.id}
            contentType={report.content_type}
            contentId={report.content_id}
            affectedUserId={affectedUserId || undefined}
            onActionComplete={handleActionComplete}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Reporter Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Reporter
            </h3>
            <div className="space-y-2">
              <p className="font-medium">
                {report.reporter.display_name || 'Anonymous'}
              </p>
              <p className="text-sm text-gray-600">{report.reporter.email}</p>
            </div>
          </div>

          {/* User History */}
          {userHistory && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <History className="h-5 w-5" />
                User History
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Warnings:</span>
                  <span className={`font-semibold ${userHistory.warnings_count > 0 ? 'text-yellow-600' : ''}`}>
                    {userHistory.warnings_count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Reports against:</span>
                  <span className={`font-semibold ${userHistory.reports_against > 0 ? 'text-orange-600' : ''}`}>
                    {userHistory.reports_against}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Content removed:</span>
                  <span className={`font-semibold ${userHistory.content_removed > 0 ? 'text-red-600' : ''}`}>
                    {userHistory.content_removed}
                  </span>
                </div>
                {userHistory.last_action && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-gray-600 mb-1">Last action:</p>
                    <p className="text-sm font-medium">
                      {userHistory.last_action.action_type.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(userHistory.last_action.created_at), { addSuffix: true })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Similar Reports */}
          {similarReports.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Similar Reports ({similarReports.length})
              </h3>
              <div className="space-y-3">
                {similarReports.map((similar) => (
                  <div key={similar.id} className="pb-3 border-b last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {CATEGORY_LABELS[similar.category] || similar.category}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(similar.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {similar.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {similar.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      by {similar.reporter.display_name || similar.reporter.email}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}