'use client'

import { useState } from 'react'
import { Flag, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface ReportButtonProps {
  contentType: 'track' | 'profile' | 'seller_listing' | 'review' | 'comment'
  contentId: string
  contentTitle?: string
  className?: string
}

const REPORT_CATEGORIES = [
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'offensive_language', label: 'Offensive Language' },
  { value: 'copyright_violation', label: 'Copyright Violation' },
  { value: 'spam', label: 'Spam' },
  { value: 'scam_fraud', label: 'Scam or Fraud' },
  { value: 'misleading_content', label: 'Misleading Content' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'other', label: 'Other' },
]

export function ReportButton({
  contentType,
  contentId,
  contentTitle,
  className = ''
}: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [hasReported, setHasReported] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!category) {
      toast.error('Please select a report category')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()

    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Please sign in to report content')
        setIsSubmitting(false)
        return
      }

      // Submit report
      const { error } = await supabase
        .from('content_reports')
        .insert({
          content_type: contentType,
          content_id: contentId,
          reporter_id: user.id,
          category,
          description: description || null,
        })

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.error('You have already reported this content')
          setHasReported(true)
        } else {
          throw error
        }
      } else {
        toast.success('Thank you for your report. We will review it soon.')
        setHasReported(true)
      }

      setIsOpen(false)
      setCategory('')
      setDescription('')
    } catch (error) {
      console.error('Error submitting report:', error)
      toast.error('Failed to submit report. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (hasReported) {
    return (
      <button
        disabled
        className={`inline-flex items-center gap-1 px-3 py-1 text-sm text-gray-400 bg-gray-50 rounded-md cursor-not-allowed ${className}`}
      >
        <Flag className="w-4 h-4" />
        Reported
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ${className}`}
        aria-label="Report content"
      >
        <Flag className="w-4 h-4" />
        Report
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Report Content</h2>
                  {contentTitle && (
                    <p className="text-sm text-gray-600">{contentTitle}</p>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Why are you reporting this?
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a reason...</option>
                    {REPORT_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional details (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Please provide more information about why you're reporting this content..."
                    maxLength={500}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {description.length}/500 characters
                  </p>
                </div>

                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-600">
                    <strong>Note:</strong> False reports may result in action against your account.
                    Please only report content that violates our community guidelines.
                  </p>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false)
                      setCategory('')
                      setDescription('')
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !category}
                    className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300 rounded-md transition-colors"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}