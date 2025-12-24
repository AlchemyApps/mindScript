'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, Input, Label, Textarea } from '@mindscript/ui'
import { Loader2, Check, X, ExternalLink } from 'lucide-react'

type SellerProfileForm = {
  username: string
  displayName: string
  bio: string
  avatarUrl: string
  businessName: string
}

const defaultForm: SellerProfileForm = {
  username: '',
  displayName: '',
  bio: '',
  avatarUrl: '',
  businessName: '',
}

export default function SellerProfileSettingsPage() {
  const router = useRouter()
  const [form, setForm] = useState<SellerProfileForm>(defaultForm)
  const [initialForm, setInitialForm] = useState<SellerProfileForm>(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/seller/profile', { cache: 'no-store' })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error || 'Failed to load profile')
        }
        const payload = await response.json()
        const profile = {
          username: payload.profile?.username || '',
          displayName: payload.profile?.displayName || '',
          bio: payload.profile?.bio || '',
          avatarUrl: payload.profile?.avatarUrl || '',
          businessName: payload.profile?.businessName || '',
        }
        setForm(profile)
        setInitialForm(profile)
      } catch (error) {
        console.error(error)
        toast.error('Unable to load profile', {
          description: error instanceof Error ? error.message : undefined,
        })
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  useEffect(() => {
    if (!form.username || form.username === initialForm.username) {
      setUsernameStatus('idle')
      setUsernameError(null)
      return
    }

    if (form.username.length < 3) {
      setUsernameStatus('taken')
      setUsernameError('Username must be at least 3 characters')
      return
    }

    setUsernameStatus('checking')
    setUsernameError(null)

    if (debounceTimer) clearTimeout(debounceTimer)

    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/profile/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: form.username }),
        })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to validate username')
        }
        setUsernameStatus(payload.available ? 'available' : 'taken')
        setUsernameError(payload.available ? null : 'Username is already taken')
      } catch (error) {
        console.error('Username check failed', error)
        setUsernameStatus('taken')
        setUsernameError(
          error instanceof Error ? error.message : 'Unable to verify username right now'
        )
      }
    }, 400)

    setDebounceTimer(timer)
    return () => clearTimeout(timer)
  }, [form.username, initialForm.username])

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm])

  const handleChange = (field: keyof SellerProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isDirty) return
    if (usernameStatus === 'taken') {
      toast.error('Please choose a different username')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/seller/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          displayName: form.displayName,
          bio: form.bio,
          avatarUrl: form.avatarUrl || null,
          businessName: form.businessName,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || 'Failed to update profile')
      }

      setInitialForm(form)
      toast.success('Seller profile updated')
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('Unable to update profile', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
      </div>
    )
  }

  const profileUrl = form.username ? `https://mindscript.app/u/${form.username}` : null

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div>
        <p className="text-sm text-gray-500">Seller Settings</p>
        <h1 className="text-3xl font-bold text-gray-900 mt-1">Customize Your Public Profile</h1>
        <p className="text-gray-600 mt-2">
          Update your public-facing information. This is what buyers will see on your marketplace page.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Identity</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(event) => handleChange('displayName', event.target.value)}
                placeholder="Sound Studio Collective"
                required
              />
              <p className="mt-1 text-sm text-gray-500">Shown prominently on your public page.</p>
            </div>
            <div>
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                value={form.businessName}
                onChange={(event) => handleChange('businessName', event.target.value)}
                placeholder="Mindful Audio LLC"
              />
              <p className="mt-1 text-sm text-gray-500">Displayed below your display name (optional).</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Public Handle</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="username">Username / Slug</Label>
              <div className="relative">
                <Input
                  id="username"
                  value={form.username}
                  onChange={(event) => handleChange('username', event.target.value.toLowerCase())}
                  placeholder="calm-collective"
                  required
                />
                {usernameStatus === 'checking' && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                )}
                {usernameStatus === 'available' && (
                  <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
                )}
                {usernameStatus === 'taken' && (
                  <X className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500" />
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Letters, numbers, dashes, underscores, and periods only.
              </p>
              {usernameError && <p className="mt-1 text-sm text-red-500">{usernameError}</p>}
            </div>
            <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              <span>Your public URL</span>
              <div className="flex items-center justify-between rounded border bg-white px-3 py-2 text-gray-800">
                <span className="truncate text-sm">
                  {profileUrl || 'https://mindscript.app/u/your-name'}
                </span>
                {profileUrl && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(profileUrl)}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    Copy
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Story & Media</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(event) => handleChange('bio', event.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Share your mission, style, or accolades..."
              />
              <div className="mt-1 text-right text-xs text-gray-500">{form.bio?.length || 0}/500</div>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input
                id="avatarUrl"
                value={form.avatarUrl || ''}
                onChange={(event) => handleChange('avatarUrl', event.target.value)}
                placeholder="https://"
              />
              <p className="mt-1 text-sm text-gray-500">
                You can upload an image in the general profile settings or paste a hosted URL here.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-500">
            Need a preview?{' '}
            {profileUrl ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
              >
                View public page
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              'Choose a username to generate your URL.'
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" disabled={!isDirty || saving} onClick={() => setForm(initialForm)}>
              Reset
            </Button>
            <Button type="submit" disabled={!isDirty || saving || usernameStatus === 'taken'}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
