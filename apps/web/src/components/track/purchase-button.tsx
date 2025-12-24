'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

type TrackPurchaseButtonProps = {
  trackId: string
  className?: string
  children?: React.ReactNode
}

export function TrackPurchaseButton({
  trackId,
  className = '',
  children = 'Buy Track',
}: TrackPurchaseButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading) return
    setLoading(true)

    try {
      const response = await fetch('/api/checkout/purchase-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'Unable to start checkout')
      }

      const payload = await response.json()
      if (payload.url) {
        window.location.href = payload.url
      } else {
        throw new Error('Missing checkout URL')
      }
    } catch (error) {
      console.error('Track checkout failed:', error)
      toast.error('Unable to start checkout', {
        description: error instanceof Error ? error.message : undefined,
      })
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 ${className}`}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {loading ? 'Redirecting…' : children}
    </button>
  )
}
