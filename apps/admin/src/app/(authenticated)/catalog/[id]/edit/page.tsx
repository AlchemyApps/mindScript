'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Music, Save, ArrowLeft, Loader2, Calendar, Globe, DollarSign } from 'lucide-react'

export default function EditTrackPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [track, setTrack] = useState<any>(null)
  const [licensing, setLicensing] = useState<any>(null)

  useEffect(() => {
    fetchTrack()
  }, [params.id])

  async function fetchTrack() {
    const supabase = createClient()

    try {
      // Fetch track details
      const { data: trackData, error: trackError } = await supabase
        .from('background_tracks')
        .select('*')
        .eq('id', params.id)
        .single()

      if (trackError) throw trackError

      setTrack(trackData)

      // Fetch licensing info
      const { data: licenseData } = await supabase
        .from('track_licensing')
        .select('*')
        .eq('track_id', params.id)
        .single()

      if (licenseData) {
        setLicensing(licenseData)
      }
    } catch (error) {
      console.error('Error fetching track:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)

    try {
      const response = await fetch('/api/catalog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: params.id,
          ...track,
          licensing
        })
      })

      if (!response.ok) throw new Error('Failed to save')

      router.push('/catalog')
    } catch (error) {
      console.error('Error saving track:', error)
      alert('Failed to save track')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!track) {
    return (
      <div className="p-8">
        <p>Track not found</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/catalog')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Catalog
        </button>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Music className="h-8 w-8" />
          Edit Track
        </h1>
      </div>

      {/* Track Details Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Track Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={track.title || ''}
              onChange={(e) => setTrack({ ...track, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Artist
            </label>
            <input
              type="text"
              value={track.artist || ''}
              onChange={(e) => setTrack({ ...track, artist: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={track.category || ''}
              onChange={(e) => setTrack({ ...track, category: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Category</option>
              <option value="meditation">Meditation</option>
              <option value="focus">Focus</option>
              <option value="nature">Nature</option>
              <option value="binaural">Binaural</option>
              <option value="solfeggio">Solfeggio</option>
              <option value="ambient">Ambient</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mood
            </label>
            <select
              value={track.mood || ''}
              onChange={(e) => setTrack({ ...track, mood: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Mood</option>
              <option value="peaceful">Peaceful</option>
              <option value="calming">Calming</option>
              <option value="focused">Focused</option>
              <option value="energizing">Energizing</option>
              <option value="neutral">Neutral</option>
              <option value="healing">Healing</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Genre
            </label>
            <input
              type="text"
              value={track.genre || ''}
              onChange={(e) => setTrack({ ...track, genre: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              BPM
            </label>
            <input
              type="number"
              value={track.bpm || ''}
              onChange={(e) => setTrack({ ...track, bpm: parseInt(e.target.value) || null })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="40"
              max="300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price (cents)
            </label>
            <input
              type="number"
              value={track.price_cents || 0}
              onChange={(e) => setTrack({ ...track, price_cents: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Key Signature
            </label>
            <input
              type="text"
              value={track.key_signature || ''}
              onChange={(e) => setTrack({ ...track, key_signature: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., C Major"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags (comma separated)
          </label>
          <input
            type="text"
            value={track.tags?.join(', ') || ''}
            onChange={(e) => setTrack({
              ...track,
              tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
            })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ambient, meditation, calm"
          />
        </div>

        <div className="mt-6 flex items-center gap-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={track.is_platform_asset || false}
              onChange={(e) => setTrack({ ...track, is_platform_asset: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Platform Asset</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={track.is_stereo || false}
              onChange={(e) => setTrack({ ...track, is_stereo: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Stereo</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={track.is_active || false}
              onChange={(e) => setTrack({ ...track, is_active: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Active</span>
          </label>
        </div>
      </div>

      {/* Licensing Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Licensing Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              License Type
            </label>
            <select
              value={licensing?.license_type || ''}
              onChange={(e) => setLicensing({ ...licensing, license_type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Type</option>
              <option value="royalty_free">Royalty Free</option>
              <option value="creative_commons">Creative Commons</option>
              <option value="exclusive">Exclusive</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              License Provider
            </label>
            <input
              type="text"
              value={licensing?.license_provider || ''}
              onChange={(e) => setLicensing({ ...licensing, license_provider: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., AudioJungle"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              License Number
            </label>
            <input
              type="text"
              value={licensing?.license_number || ''}
              onChange={(e) => setLicensing({ ...licensing, license_number: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cost (USD)
            </label>
            <input
              type="number"
              value={licensing?.cost_usd || ''}
              onChange={(e) => setLicensing({ ...licensing, cost_usd: parseFloat(e.target.value) || null })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              step="0.01"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purchase Date
            </label>
            <input
              type="date"
              value={licensing?.purchase_date || ''}
              onChange={(e) => setLicensing({ ...licensing, purchase_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiry Date
            </label>
            <input
              type="date"
              value={licensing?.expiry_date || ''}
              onChange={(e) => setLicensing({ ...licensing, expiry_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Usage Restrictions
          </label>
          <textarea
            value={licensing?.usage_restrictions || ''}
            onChange={(e) => setLicensing({ ...licensing, usage_restrictions: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={licensing?.attribution_required || false}
              onChange={(e) => setLicensing({ ...licensing, attribution_required: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Attribution Required</span>
          </label>

          {licensing?.attribution_required && (
            <input
              type="text"
              value={licensing?.attribution_text || ''}
              onChange={(e) => setLicensing({ ...licensing, attribution_text: e.target.value })}
              className="w-full mt-2 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Attribution text"
            />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <button
          onClick={() => router.push('/catalog')}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !track.title}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </button>
      </div>
    </div>
  )
}