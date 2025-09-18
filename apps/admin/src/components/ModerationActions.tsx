'use client'

import { useState } from 'react'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Ban,
  ShieldOff,
  Send,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface ModerationActionsProps {
  reportId: string
  contentType: string
  contentId: string
  affectedUserId?: string
  onActionComplete?: () => void
}

const ACTION_TEMPLATES = {
  warning: {
    title: 'Issue Warning',
    icon: AlertTriangle,
    color: 'yellow',
    reasons: [
      'Minor policy violation',
      'First-time offense',
      'Unintentional violation',
      'Borderline content',
    ],
  },
  remove: {
    title: 'Remove Content',
    icon: XCircle,
    color: 'orange',
    reasons: [
      'Clear policy violation',
      'Inappropriate content',
      'Copyright infringement',
      'Misleading information',
    ],
  },
  delist: {
    title: 'Delist from Marketplace',
    icon: ShieldOff,
    color: 'red',
    reasons: [
      'Commercial policy violation',
      'Fraudulent listing',
      'Repeated violations',
      'Quality standards not met',
    ],
  },
  suspend: {
    title: 'Suspend User',
    icon: Ban,
    color: 'red',
    reasons: [
      'Severe policy violation',
      'Repeated offenses',
      'Harmful behavior',
      'Terms of service breach',
    ],
  },
  dismiss: {
    title: 'Dismiss Report',
    icon: CheckCircle,
    color: 'green',
    reasons: [
      'No policy violation',
      'False report',
      'Already resolved',
      'Insufficient evidence',
    ],
  },
}

export function ModerationActions({
  reportId,
  contentType,
  contentId,
  affectedUserId,
  onActionComplete,
}: ModerationActionsProps) {
  const [selectedAction, setSelectedAction] = useState<string>('')
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [customReason, setCustomReason] = useState<string>('')
  const [internalNotes, setInternalNotes] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleSubmit = async () => {
    if (!selectedAction) {
      toast.error('Please select an action')
      return
    }

    if (!selectedReason && !customReason) {
      toast.error('Please provide a reason')
      return
    }

    setShowConfirmation(true)
  }

  const confirmAction = async () => {
    setIsSubmitting(true)
    const supabase = createClient()

    try {
      // Get current user (moderator)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const reason = customReason || selectedReason

      // Create moderation action record
      const actionTypeMap: Record<string, string> = {
        warning: 'warning_issued',
        remove: 'content_removed',
        delist: 'marketplace_delisted',
        suspend: 'user_suspended',
        dismiss: 'no_action',
      }

      const { data: action, error: actionError } = await supabase
        .from('moderation_actions')
        .insert({
          action_type: actionTypeMap[selectedAction],
          content_type: contentType,
          content_id: contentId,
          affected_user_id: affectedUserId,
          moderator_id: user.id,
          reason,
          internal_notes: internalNotes || null,
          related_report_ids: [reportId],
        })
        .select()
        .single()

      if (actionError) throw actionError

      // Update report status
      const reportStatus = selectedAction === 'dismiss' ? 'dismissed' : 'actioned'
      const { error: reportError } = await supabase
        .from('content_reports')
        .update({
          status: reportStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          review_notes: reason,
        })
        .eq('id', reportId)

      if (reportError) throw reportError

      // Handle specific actions
      switch (selectedAction) {
        case 'warning':
          if (affectedUserId) {
            await supabase
              .from('user_warnings')
              .insert({
                user_id: affectedUserId,
                warning_level: 1,
                action_id: action.id,
                reason,
                message_sent: `Your content has been flagged for: ${reason}. Please review our community guidelines.`,
              })
          }
          break

        case 'remove':
          // Update content status (depends on content type)
          if (contentType === 'track') {
            await supabase
              .from('tracks')
              .update({ status: 'removed' })
              .eq('id', contentId)
          }
          break

        case 'delist':
          // Remove from marketplace
          if (contentType === 'track') {
            await supabase
              .from('tracks')
              .update({ is_public: false })
              .eq('id', contentId)
          }
          break

        case 'suspend':
          // Suspend user account
          if (affectedUserId) {
            await supabase
              .from('profiles')
              .update({
                is_suspended: true,
                suspended_at: new Date().toISOString(),
                suspension_reason: reason,
              })
              .eq('id', affectedUserId)
          }
          break
      }

      // Update reporter credibility
      const wasAccurate = selectedAction !== 'dismiss'
      await supabase.rpc('update_reporter_credibility', {
        p_report_id: reportId,
        p_was_accurate: wasAccurate,
      })

      toast.success(`Action completed: ${ACTION_TEMPLATES[selectedAction as keyof typeof ACTION_TEMPLATES].title}`)
      setShowConfirmation(false)
      onActionComplete?.()

    } catch (error) {
      console.error('Error processing moderation action:', error)
      toast.error('Failed to process action')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Moderation Actions</h3>

        {/* Action Selection */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {Object.entries(ACTION_TEMPLATES).map(([key, config]) => {
            const Icon = config.icon
            const isSelected = selectedAction === key
            const colorClasses = {
              green: 'border-green-500 bg-green-50 text-green-700',
              yellow: 'border-yellow-500 bg-yellow-50 text-yellow-700',
              orange: 'border-orange-500 bg-orange-50 text-orange-700',
              red: 'border-red-500 bg-red-50 text-red-700',
            }[config.color]

            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedAction(key)
                  setSelectedReason('')
                  setCustomReason('')
                }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? colorClasses
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon className="h-5 w-5 mx-auto mb-1" />
                <span className="text-sm font-medium">{config.title}</span>
              </button>
            )
          })}
        </div>

        {/* Reason Selection */}
        {selectedAction && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select or provide a reason
              </label>
              <select
                value={selectedReason}
                onChange={(e) => {
                  setSelectedReason(e.target.value)
                  setCustomReason('')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a template reason...</option>
                {ACTION_TEMPLATES[selectedAction as keyof typeof ACTION_TEMPLATES].reasons.map(
                  (reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or provide custom reason
              </label>
              <textarea
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value)
                  setSelectedReason('')
                }}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Explain the specific reason for this action..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Internal notes (not shown to user)
              </label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Additional context for team members..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || (!selectedReason && !customReason)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
              >
                <Send className="h-4 w-4" />
                Submit Action
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {showConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-3">Confirm Action</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to{' '}
                <strong>
                  {ACTION_TEMPLATES[selectedAction as keyof typeof ACTION_TEMPLATES].title.toLowerCase()}
                </strong>
                ?
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Reason: {customReason || selectedReason}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAction}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}