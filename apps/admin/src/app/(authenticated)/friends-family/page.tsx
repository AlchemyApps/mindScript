'use client'

import { useEffect, useState } from 'react'
import { Heart, Send, XCircle, RefreshCw, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface Invite {
  id: string
  code: string
  email: string
  tier: 'inner_circle' | 'cost_pass'
  status: 'pending' | 'redeemed' | 'revoked'
  redeemed_by: string | null
  redeemed_at: string | null
  created_at: string
}

export default function FriendsAndFamilyPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formTier, setFormTier] = useState<'inner_circle' | 'cost_pass'>('inner_circle')
  const [submitting, setSubmitting] = useState(false)

  const fetchInvites = async () => {
    try {
      const res = await fetch('/api/ff/invites')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setInvites(data.invites || [])
    } catch (err) {
      console.error('Error fetching invites:', err)
      toast.error('Failed to load invites')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvites()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/ff/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formEmail, tier: formTier }),
      })
      if (!res.ok) throw new Error('Failed to create invite')
      toast.success('Invite sent!')
      setFormEmail('')
      setShowForm(false)
      await fetchInvites()
    } catch {
      toast.error('Failed to create invite')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAction = async (id: string, action: 'revoke' | 'resend') => {
    try {
      const res = await fetch(`/api/ff/invites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error(`Failed to ${action}`)
      toast.success(action === 'revoke' ? 'Invite revoked' : 'Invite resent')
      await fetchInvites()
    } catch {
      toast.error(`Failed to ${action} invite`)
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Pending</span>
      case 'redeemed':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Redeemed</span>
      case 'revoked':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Revoked</span>
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">{status}</span>
    }
  }

  const tierBadge = (tier: string) => {
    return tier === 'inner_circle'
      ? <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">Inner Circle</span>
      : <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700">Cost Pass</span>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Heart className="h-6 w-6 text-pink-500" />
            Friends & Family
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage invite codes and F&F access tiers
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Send Invite
        </button>
      </div>

      {/* Create Invite Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Invite</h3>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="friend@example.com"
              />
            </div>
            <div className="w-48">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tier
              </label>
              <select
                value={formTier}
                onChange={(e) => setFormTier(e.target.value as 'inner_circle' | 'cost_pass')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="inner_circle">Inner Circle (Free)</option>
                <option value="cost_pass">Cost Pass (At Cost)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </form>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Invites</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{invites.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{invites.filter(i => i.status === 'pending').length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Redeemed</p>
          <p className="text-2xl font-bold text-green-600">{invites.filter(i => i.status === 'redeemed').length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Revoked</p>
          <p className="text-2xl font-bold text-red-600">{invites.filter(i => i.status === 'revoked').length}</p>
        </div>
      </div>

      {/* Invites Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : invites.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No invites yet. Click "Send Invite" to get started.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Redeemed</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {invites.map((invite) => (
                <tr key={invite.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{invite.email}</td>
                  <td className="px-6 py-4">{tierBadge(invite.tier)}</td>
                  <td className="px-6 py-4">{statusBadge(invite.status)}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">{invite.code}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(invite.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {invite.redeemed_at
                      ? new Date(invite.redeemed_at).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {invite.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAction(invite.id, 'resend')}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="Resend"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAction(invite.id, 'revoke')}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Revoke"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {invite.status === 'redeemed' && (
                        <button
                          onClick={() => handleAction(invite.id, 'revoke')}
                          className="p-1 text-red-600 hover:text-red-800"
                          title="Revoke Access"
                        >
                          <XCircle className="h-4 w-4" />
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
