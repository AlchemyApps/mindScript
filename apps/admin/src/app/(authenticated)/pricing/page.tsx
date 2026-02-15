'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign,
  Save,
  Music,
  Mic2,
  Settings,
  Loader2,
  AlertCircle,
  Check,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──

type GlobalPricing = {
  first_track_cents: number
  standard_track_cents: number
  solfeggio_cents: number
  binaural_cents: number
  edit_fee_cents: number
  free_edit_limit: number
  voice_clone_fee_cents: number
  premium_voice_short_cents: number
  premium_voice_medium_cents: number
  premium_voice_long_cents: number
  premium_voice_extended_cents: number
  premium_voice_short_max_chars: number
  premium_voice_medium_max_chars: number
  premium_voice_long_max_chars: number
  premium_voice_extended_max_chars: number
  elevenlabs_cost_per_char_millicents: number
  openai_tts_cost_per_char_millicents: number
  standard_bg_track_cents: number
}

type Voice = {
  id: string
  internal_code: string
  display_name: string
  description: string | null
  gender: string
  tier: string
  provider: string
  provider_voice_id: string
  preview_url: string | null
  is_enabled: boolean
  sort_order: number
  price_cents: number | null
}

type BackgroundTrack = {
  id: string
  title: string
  slug: string
  category: string
  bpm: number | null
  key_signature: string | null
  price_cents: number
  duration_seconds: number | null
  is_active: boolean
  is_platform_asset: boolean
  tier: 'standard' | 'premium'
}

// ── Main Component ──

export default function PricingPage() {
  const [activeTab, setActiveTab] = useState<'global' | 'voices' | 'tracks'>('global')
  const [isLoading, setIsLoading] = useState(true)

  // Global pricing
  const [global, setGlobal] = useState<GlobalPricing | null>(null)
  const [globalDirty, setGlobalDirty] = useState(false)
  const [globalSaving, setGlobalSaving] = useState(false)

  // Voices
  const [voices, setVoices] = useState<Voice[]>([])
  const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null)
  const [voiceSaving, setVoiceSaving] = useState<string | null>(null)

  // Background tracks
  const [tracks, setTracks] = useState<BackgroundTrack[]>([])
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null)
  const [trackSaving, setTrackSaving] = useState<string | null>(null)

  const loadAllData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [globalRes, voicesRes, tracksRes] = await Promise.all([
        fetch('/api/pricing/global'),
        fetch('/api/pricing/voices'),
        fetch('/api/pricing/background-tracks'),
      ])

      if (!globalRes.ok || !voicesRes.ok || !tracksRes.ok) {
        throw new Error('Failed to load pricing data')
      }

      const [globalData, voicesData, tracksData] = await Promise.all([
        globalRes.json(),
        voicesRes.json(),
        tracksRes.json(),
      ])

      setGlobal(globalData)
      setVoices(voicesData)
      setTracks(tracksData)
      setGlobalDirty(false)
    } catch (error) {
      console.error('Failed to load pricing data:', error)
      toast.error('Unable to load pricing data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadAllData() }, [loadAllData])

  // ── Global Settings Handlers ──

  const updateGlobalField = (field: keyof GlobalPricing, value: number) => {
    if (!global) return
    setGlobal({ ...global, [field]: value })
    setGlobalDirty(true)
  }

  const saveGlobalSettings = async () => {
    if (!global || !globalDirty) return
    setGlobalSaving(true)
    try {
      const res = await fetch('/api/pricing/global', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(global),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Global settings saved')
      setGlobalDirty(false)
    } catch {
      toast.error('Failed to save global settings')
    } finally {
      setGlobalSaving(false)
    }
  }

  // ── Voice Handlers ──

  const saveVoice = async (voice: Voice) => {
    setVoiceSaving(voice.id)
    try {
      const res = await fetch('/api/pricing/voices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: voice.id,
          display_name: voice.display_name,
          price_cents: voice.price_cents,
          tier: voice.tier,
          is_enabled: voice.is_enabled,
        }),
      })
      if (!res.ok) throw new Error('Failed to save voice')
      const updated = await res.json()
      setVoices(prev => prev.map(v => v.id === updated.id ? { ...v, ...updated } : v))
      setEditingVoiceId(null)
      toast.success('Voice updated')
    } catch {
      toast.error('Failed to update voice')
    } finally {
      setVoiceSaving(null)
    }
  }

  const toggleVoice = async (voice: Voice) => {
    const updated = { ...voice, is_enabled: !voice.is_enabled }
    setVoices(prev => prev.map(v => v.id === voice.id ? updated : v))
    setVoiceSaving(voice.id)
    try {
      const res = await fetch('/api/pricing/voices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: voice.id, is_enabled: updated.is_enabled }),
      })
      if (!res.ok) throw new Error('Failed to toggle voice')
      toast.success(updated.is_enabled ? 'Voice enabled' : 'Voice disabled')
    } catch {
      setVoices(prev => prev.map(v => v.id === voice.id ? voice : v))
      toast.error('Failed to toggle voice')
    } finally {
      setVoiceSaving(null)
    }
  }

  // ── Track Handlers ──

  const saveTrack = async (track: BackgroundTrack) => {
    setTrackSaving(track.id)
    try {
      const res = await fetch('/api/pricing/background-tracks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: track.id,
          title: track.title,
          price_cents: track.price_cents,
          is_active: track.is_active,
          tier: track.tier,
        }),
      })
      if (!res.ok) throw new Error('Failed to save track')
      const updated = await res.json()
      setTracks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
      setEditingTrackId(null)
      toast.success('Track updated')
    } catch {
      toast.error('Failed to update track')
    } finally {
      setTrackSaving(null)
    }
  }

  const toggleTrack = async (track: BackgroundTrack) => {
    const updated = { ...track, is_active: !track.is_active }
    setTracks(prev => prev.map(t => t.id === track.id ? updated : t))
    setTrackSaving(track.id)
    try {
      const res = await fetch('/api/pricing/background-tracks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: track.id, is_active: updated.is_active }),
      })
      if (!res.ok) throw new Error('Failed to toggle track')
      toast.success(updated.is_active ? 'Track activated' : 'Track deactivated')
    } catch {
      setTracks(prev => prev.map(t => t.id === track.id ? track : t))
      toast.error('Failed to toggle track')
    } finally {
      setTrackSaving(null)
    }
  }

  // ── Render ──

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-blue-500 mx-auto mb-3 animate-spin" />
          <p className="text-gray-500">Loading pricing data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <DollarSign className="h-8 w-8" />
          Pricing Management
        </h1>
        <p className="text-gray-600 mt-2">
          Manage track pricing, add-on fees, voice prices, and background music prices
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex">
            <TabButton
              active={activeTab === 'global'}
              onClick={() => setActiveTab('global')}
              icon={<Settings className="h-4 w-4" />}
              label="Global Settings"
            />
            <TabButton
              active={activeTab === 'voices'}
              onClick={() => setActiveTab('voices')}
              icon={<Mic2 className="h-4 w-4" />}
              label={`Voices (${voices.length})`}
            />
            <TabButton
              active={activeTab === 'tracks'}
              onClick={() => setActiveTab('tracks')}
              icon={<Music className="h-4 w-4" />}
              label={`Background Tracks (${tracks.length})`}
            />
          </div>
        </div>

        <div className="p-6">
          {/* Global Settings Tab */}
          {activeTab === 'global' && global && (
            <div className="space-y-8 max-w-2xl">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Track Pricing</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <CentsInput
                    label="First Track Price"
                    value={global.first_track_cents}
                    onChange={(v) => updateGlobalField('first_track_cents', v)}
                  />
                  <CentsInput
                    label="Standard Track Price"
                    value={global.standard_track_cents}
                    onChange={(v) => updateGlobalField('standard_track_cents', v)}
                  />
                  <CentsInput
                    label="Standard BG Track Price"
                    value={global.standard_bg_track_cents}
                    onChange={(v) => updateGlobalField('standard_bg_track_cents', v)}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  First track includes: standard voice, standard BG track, solfeggio, binaural — all at the First Track Price. After first purchase, standard rates apply.
                </p>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Add-on Pricing</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CentsInput
                    label="Solfeggio Frequency"
                    value={global.solfeggio_cents}
                    onChange={(v) => updateGlobalField('solfeggio_cents', v)}
                  />
                  <CentsInput
                    label="Binaural Beats"
                    value={global.binaural_cents}
                    onChange={(v) => updateGlobalField('binaural_cents', v)}
                  />
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Voice Clone Fee</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CentsInput
                    label="Voice Clone Setup Fee"
                    value={global.voice_clone_fee_cents}
                    onChange={(v) => updateGlobalField('voice_clone_fee_cents', v)}
                  />
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Premium Voice Pricing Tiers</h2>
                <p className="text-sm text-gray-500 mb-4">Per-track fees for premium and custom voices based on script length.</p>
                <div className="space-y-4">
                  {(['short', 'medium', 'long', 'extended'] as const).map((tier) => (
                    <div key={tier} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{tier} Tier</label>
                        <p className="text-xs text-gray-500">Max characters for this tier</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Chars</label>
                        <input
                          type="number"
                          value={global[`premium_voice_${tier}_max_chars`]}
                          onChange={(e) => updateGlobalField(`premium_voice_${tier}_max_chars`, parseInt(e.target.value) || 0)}
                          min={1}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <CentsInput
                        label="Price"
                        value={global[`premium_voice_${tier}_cents`]}
                        onChange={(v) => updateGlobalField(`premium_voice_${tier}_cents`, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">COGS Rates</h2>
                <p className="text-sm text-gray-500 mb-4">Cost-of-goods rates in millicents per character (1 millicent = $0.00001).</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MillicentsInput
                    label="ElevenLabs Cost/Char"
                    value={global.elevenlabs_cost_per_char_millicents}
                    onChange={(v) => updateGlobalField('elevenlabs_cost_per_char_millicents', v)}
                  />
                  <MillicentsInput
                    label="OpenAI TTS Cost/Char"
                    value={global.openai_tts_cost_per_char_millicents}
                    onChange={(v) => updateGlobalField('openai_tts_cost_per_char_millicents', v)}
                  />
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CentsInput
                    label="Edit Fee"
                    value={global.edit_fee_cents}
                    onChange={(v) => updateGlobalField('edit_fee_cents', v)}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Free Edit Limit
                    </label>
                    <input
                      type="number"
                      value={global.free_edit_limit}
                      onChange={(e) => updateGlobalField('free_edit_limit', parseInt(e.target.value) || 0)}
                      min={0}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Number of free edits per track</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2 flex-1 mr-4">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-700">
                    Changes affect all new transactions immediately.
                  </p>
                </div>
                <button
                  onClick={saveGlobalSettings}
                  disabled={!globalDirty || globalSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {globalSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {globalSaving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Voices Tab */}
          {activeTab === 'voices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900">Voice Catalog</h2>
                <p className="text-sm text-gray-500">
                  Set per-voice price overrides. Empty price uses tier default.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 pr-4 font-medium">Name</th>
                      <th className="pb-3 pr-4 font-medium">Provider</th>
                      <th className="pb-3 pr-4 font-medium">Tier</th>
                      <th className="pb-3 pr-4 font-medium">Price</th>
                      <th className="pb-3 pr-4 font-medium text-center">Enabled</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {voices.map((voice) => {
                      const isEditing = editingVoiceId === voice.id
                      const isSaving = voiceSaving === voice.id

                      return (
                        <VoiceRow
                          key={voice.id}
                          voice={voice}
                          isEditing={isEditing}
                          isSaving={isSaving}
                          onEdit={() => setEditingVoiceId(voice.id)}
                          onCancel={() => setEditingVoiceId(null)}
                          onSave={saveVoice}
                          onToggle={() => toggleVoice(voice)}
                          onUpdateLocal={(updated) =>
                            setVoices(prev => prev.map(v => v.id === voice.id ? updated : v))
                          }
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Background Tracks Tab */}
          {activeTab === 'tracks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900">Background Tracks</h2>
                <p className="text-sm text-gray-500">
                  Manage pricing and availability of background music.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 pr-4 font-medium">Title</th>
                      <th className="pb-3 pr-4 font-medium">Category</th>
                      <th className="pb-3 pr-4 font-medium">BPM</th>
                      <th className="pb-3 pr-4 font-medium">Tier</th>
                      <th className="pb-3 pr-4 font-medium">Price</th>
                      <th className="pb-3 pr-4 font-medium text-center">Active</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tracks.map((track) => {
                      const isEditing = editingTrackId === track.id
                      const isSaving = trackSaving === track.id

                      return (
                        <TrackRow
                          key={track.id}
                          track={track}
                          isEditing={isEditing}
                          isSaving={isSaving}
                          onEdit={() => setEditingTrackId(track.id)}
                          onCancel={() => setEditingTrackId(null)}
                          onSave={saveTrack}
                          onToggle={() => toggleTrack(track)}
                          onUpdateLocal={(updated) =>
                            setTracks(prev => prev.map(t => t.id === track.id ? updated : t))
                          }
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Subcomponents ──

function TabButton({ active, onClick, icon, label }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${
        active
          ? 'border-b-2 border-blue-500 text-blue-600'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function CentsInput({ label, value, onChange }: {
  label: string
  value: number
  onChange: (cents: number) => void
}) {
  const [display, setDisplay] = useState((value / 100).toFixed(2))
  const [focused, setFocused] = useState(false)

  // Sync display when value changes externally (not while focused)
  useEffect(() => {
    if (!focused) setDisplay((value / 100).toFixed(2))
  }, [value, focused])

  const commit = (raw: string) => {
    const dollars = parseFloat(raw)
    if (!Number.isNaN(dollars) && dollars >= 0) {
      onChange(Math.round(dollars * 100))
      setDisplay(dollars.toFixed(2))
    } else {
      setDisplay((value / 100).toFixed(2))
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={display}
          onChange={(e) => setDisplay(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={(e) => { setFocused(false); commit(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(display) }}
          className="w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}

function MillicentsInput({ label, value, onChange }: {
  label: string
  value: number
  onChange: (millicents: number) => void
}) {
  const [display, setDisplay] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDisplay(String(value))
  }, [value, focused])

  const commit = (raw: string) => {
    const val = parseFloat(raw)
    if (!Number.isNaN(val) && val >= 0) {
      onChange(val)
      setDisplay(String(val))
    } else {
      setDisplay(String(value))
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={(e) => setDisplay(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => { setFocused(false); commit(e.target.value) }}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(display) }}
        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="text-xs text-gray-500 mt-1">
        = ${(value / 100_000).toFixed(6)}/char
      </p>
    </div>
  )
}

function VoiceRow({ voice, isEditing, isSaving, onEdit, onCancel, onSave, onToggle, onUpdateLocal }: {
  voice: Voice
  isEditing: boolean
  isSaving: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (voice: Voice) => void
  onToggle: () => void
  onUpdateLocal: (voice: Voice) => void
}) {
  const tierColors: Record<string, string> = {
    included: 'bg-green-100 text-green-700',
    premium: 'bg-purple-100 text-purple-700',
    custom: 'bg-amber-100 text-amber-700',
  }

  if (isEditing) {
    return (
      <tr className="bg-blue-50/50">
        <td className="py-3 pr-4">
          <input
            type="text"
            value={voice.display_name}
            onChange={(e) => onUpdateLocal({ ...voice, display_name: e.target.value })}
            className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </td>
        <td className="py-3 pr-4 text-gray-600">{voice.provider}</td>
        <td className="py-3 pr-4">
          <select
            value={voice.tier}
            onChange={(e) => onUpdateLocal({ ...voice, tier: e.target.value })}
            className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="included">Included</option>
            <option value="premium">Premium</option>
            <option value="custom">Custom</option>
          </select>
        </td>
        <td className="py-3 pr-4">
          <div className="relative w-24">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
            <input
              type="number"
              value={voice.price_cents != null ? (voice.price_cents / 100).toFixed(2) : ''}
              onChange={(e) => {
                const val = e.target.value
                onUpdateLocal({
                  ...voice,
                  price_cents: val === '' ? null : Math.round(parseFloat(val) * 100),
                })
              }}
              placeholder="--"
              step="0.01"
              min="0"
              className="w-full pl-6 pr-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </td>
        <td className="py-3 pr-4 text-center">
          <ToggleSwitch enabled={voice.is_enabled} onToggle={() => onUpdateLocal({ ...voice, is_enabled: !voice.is_enabled })} />
        </td>
        <td className="py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onSave(voice)}
              disabled={isSaving}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
              title="Save"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button
              onClick={onCancel}
              className="p-1.5 text-gray-400 hover:bg-gray-50 rounded"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`hover:bg-gray-50 ${!voice.is_enabled ? 'opacity-50' : ''}`}>
      <td className="py-3 pr-4 font-medium text-gray-900">{voice.display_name}</td>
      <td className="py-3 pr-4 text-gray-600 capitalize">{voice.provider}</td>
      <td className="py-3 pr-4">
        <span className={`px-2 py-0.5 text-xs rounded-full ${tierColors[voice.tier] || 'bg-gray-100 text-gray-600'}`}>
          {voice.tier}
        </span>
      </td>
      <td className="py-3 pr-4 text-gray-600">
        {voice.price_cents != null ? `$${(voice.price_cents / 100).toFixed(2)}` : '--'}
      </td>
      <td className="py-3 pr-4 text-center">
        <ToggleSwitch enabled={voice.is_enabled} onToggle={onToggle} disabled={isSaving} />
      </td>
      <td className="py-3 text-right">
        <button
          onClick={onEdit}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Edit
        </button>
      </td>
    </tr>
  )
}

function TrackRow({ track, isEditing, isSaving, onEdit, onCancel, onSave, onToggle, onUpdateLocal }: {
  track: BackgroundTrack
  isEditing: boolean
  isSaving: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (track: BackgroundTrack) => void
  onToggle: () => void
  onUpdateLocal: (track: BackgroundTrack) => void
}) {
  if (isEditing) {
    return (
      <tr className="bg-blue-50/50">
        <td className="py-3 pr-4">
          <input
            type="text"
            value={track.title}
            onChange={(e) => onUpdateLocal({ ...track, title: e.target.value })}
            className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </td>
        <td className="py-3 pr-4 text-gray-600">{track.category}</td>
        <td className="py-3 pr-4 text-gray-600">{track.bpm || '--'}</td>
        <td className="py-3 pr-4">
          <select
            value={track.tier}
            onChange={(e) => onUpdateLocal({ ...track, tier: e.target.value as 'standard' | 'premium' })}
            className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
        </td>
        <td className="py-3 pr-4">
          <div className="relative w-24">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
            <input
              type="number"
              value={(track.price_cents / 100).toFixed(2)}
              onChange={(e) => {
                const dollars = parseFloat(e.target.value)
                if (!Number.isNaN(dollars)) {
                  onUpdateLocal({ ...track, price_cents: Math.round(dollars * 100) })
                }
              }}
              step="0.01"
              min="0"
              className="w-full pl-6 pr-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </td>
        <td className="py-3 pr-4 text-center">
          <ToggleSwitch enabled={track.is_active} onToggle={() => onUpdateLocal({ ...track, is_active: !track.is_active })} />
        </td>
        <td className="py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onSave(track)}
              disabled={isSaving}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
              title="Save"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button
              onClick={onCancel}
              className="p-1.5 text-gray-400 hover:bg-gray-50 rounded"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`hover:bg-gray-50 ${!track.is_active ? 'opacity-50' : ''}`}>
      <td className="py-3 pr-4 font-medium text-gray-900">{track.title}</td>
      <td className="py-3 pr-4 text-gray-600">{track.category}</td>
      <td className="py-3 pr-4 text-gray-600">{track.bpm || '--'}</td>
      <td className="py-3 pr-4">
        <span className={`px-2 py-0.5 text-xs rounded-full ${track.tier === 'premium' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
          {track.tier}
        </span>
      </td>
      <td className="py-3 pr-4 text-gray-600">${(track.price_cents / 100).toFixed(2)}</td>
      <td className="py-3 pr-4 text-center">
        <ToggleSwitch enabled={track.is_active} onToggle={onToggle} disabled={isSaving} />
      </td>
      <td className="py-3 text-right">
        <button
          onClick={onEdit}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Edit
        </button>
      </td>
    </tr>
  )
}

function ToggleSwitch({ enabled, onToggle, disabled }: {
  enabled: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        enabled ? 'bg-blue-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
