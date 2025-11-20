'use client'

import { useState, useEffect } from 'react'
import {
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronUp,
  ChevronDown,
  Package,
  ToggleLeft,
  AlertCircle,
  Check,
  Clock,
  Users,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'

type PricingTier = {
  id: string
  name: string
  slug: string
  description: string
  price_cents: number
  currency: string
  interval: 'one_time' | 'monthly' | 'yearly'
  interval_count: number
  features: string[]
  stripe_price_id?: string
  stripe_test_price_id?: string
  position: number
  is_active: boolean
  is_default: boolean
  subscriber_count?: number
  active_subscribers?: number
}

type FeatureFlag = {
  id: string
  key: string
  name: string
  description: string
  type: 'boolean' | 'number' | 'string' | 'json'
  default_value: any
  tier_overrides: Record<string, any>
  is_active: boolean
  rollout_percentage: number
}

type PricingConfig = {
  id: string
  key: string
  value: any
  description: string
  category: string
  is_active: boolean
}

export default function PricingPage() {
  const [activeTab, setActiveTab] = useState<'tiers' | 'features' | 'config'>('tiers')
  const [tiers, setTiers] = useState<PricingTier[]>([])
  const [features, setFeatures] = useState<FeatureFlag[]>([])
  const [configs, setConfigs] = useState<PricingConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [editingTier, setEditingTier] = useState<string | null>(null)
  const [showNewTierForm, setShowNewTierForm] = useState(false)
  const [showNewFeatureForm, setShowNewFeatureForm] = useState(false)
  const [tierMutationLoading, setTierMutationLoading] = useState(false)
  const [tierDeleteId, setTierDeleteId] = useState<string | null>(null)
  const [tierReorderId, setTierReorderId] = useState<string | null>(null)
  const [featureMutationId, setFeatureMutationId] = useState<string | null>(null)
  const [configSavingId, setConfigSavingId] = useState<string | null>(null)

  const parseFeatureList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string')
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          return parsed.filter((item): item is string => typeof item === 'string')
        }
      } catch {
        return value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      }
    }

    return []
  }

  const normalizeTier = (tier: PricingTier): PricingTier => ({
    ...tier,
    features: parseFeatureList(tier.features),
  })

  const updateConfigLocalValue = (configId: string, value: any) => {
    setConfigs((prev) =>
      prev.map((config) =>
        config.id === configId ? { ...config, value } : config
      )
    )
  }

  const loadPricingData = async ({ withLoader = false }: { withLoader?: boolean } = {}) => {
    if (withLoader) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const [tiersRes, featuresRes, configsRes] = await Promise.all([
        fetch('/api/pricing/tiers'),
        fetch('/api/pricing/features'),
        fetch('/api/pricing/configs')
      ])

      if (!tiersRes.ok || !featuresRes.ok || !configsRes.ok) {
        throw new Error('One or more pricing endpoints returned an error')
      }

      const [tiersData, featuresData, configsData] = await Promise.all([
        tiersRes.json(),
        featuresRes.json(),
        configsRes.json(),
      ])

      setTiers((tiersData || []).map(normalizeTier))
      setFeatures(featuresData || [])
      setConfigs(configsData || [])
    } catch (error) {
      console.error('Failed to load pricing data:', error)
      toast.error('Unable to load pricing data', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      if (withLoader) {
        setIsLoading(false)
      } else {
        setIsRefreshing(false)
      }
    }
  }

  // Load data on mount
  useEffect(() => {
    loadPricingData({ withLoader: true })
  }, [])

  const handleSaveTier = async (tier: Partial<PricingTier>) => {
    setTierMutationLoading(true)

    try {
      const method = tier.id ? 'PUT' : 'POST'
      const url = tier.id ? `/api/pricing/tiers/${tier.id}` : '/api/pricing/tiers'
      const payload = {
        ...tier,
        price_cents: typeof tier.price_cents === 'number' ? tier.price_cents : 0,
        features: parseFeatureList(tier.features),
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const details = await res.json().catch(() => null)
        throw new Error(details?.error || 'Failed to persist tier')
      }

      toast.success(tier.id ? 'Tier updated' : 'Tier created')
      await loadPricingData()
      setEditingTier(null)
      setShowNewTierForm(false)
    } catch (error) {
      console.error('Failed to save tier:', error)
      toast.error('Failed to save tier', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setTierMutationLoading(false)
    }
  }

  const handleDeleteTier = async (tierId: string) => {
    if (!confirm('Are you sure you want to delete this tier?')) return

    setTierDeleteId(tierId)

    try {
      const res = await fetch(`/api/pricing/tiers/${tierId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const details = await res.json().catch(() => null)
        throw new Error(details?.error || 'Failed to delete tier')
      }

      toast.success('Tier deleted')
      await loadPricingData()
    } catch (error) {
      console.error('Failed to delete tier:', error)
      toast.error('Failed to delete tier', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setTierDeleteId(null)
    }
  }

  const handleReorderTier = async (tierId: string, direction: 'up' | 'down') => {
    const tierIndex = tiers.findIndex(t => t.id === tierId)
    if (tierIndex === -1) return

    const newTiers = [...tiers]
    if (direction === 'up' && tierIndex > 0) {
      [newTiers[tierIndex], newTiers[tierIndex - 1]] = [newTiers[tierIndex - 1], newTiers[tierIndex]]
    } else if (direction === 'down' && tierIndex < tiers.length - 1) {
      [newTiers[tierIndex], newTiers[tierIndex + 1]] = [newTiers[tierIndex + 1], newTiers[tierIndex]]
    }

    // Update positions
    const updates = newTiers.map((tier, index) => ({
      id: tier.id,
      position: index
    }))

    setTiers(newTiers)
    setTierReorderId(tierId)

    try {
      const res = await fetch('/api/pricing/tiers/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!res.ok) {
        const details = await res.json().catch(() => null)
        throw new Error(details?.error || 'Failed to reorder tiers')
      }

      toast.success('Tier order updated')
      await loadPricingData()
    } catch (error) {
      console.error('Failed to reorder tiers:', error)
      toast.error('Failed to reorder tiers', {
        description: error instanceof Error ? error.message : undefined,
      })
      await loadPricingData()
    } finally {
      setTierReorderId(null)
    }
  }

  const handleToggleFeature = async (featureId: string, isActive: boolean) => {
    setFeatureMutationId(featureId)

    try {
      const res = await fetch(`/api/pricing/features/${featureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive })
      })

      if (!res.ok) {
        const details = await res.json().catch(() => null)
        throw new Error(details?.error || 'Failed to update feature')
      }

      setFeatures(features.map(f =>
        f.id === featureId ? { ...f, is_active: isActive } : f
      ))
      toast.success(isActive ? 'Feature enabled' : 'Feature disabled')
    } catch (error) {
      console.error('Failed to toggle feature:', error)
      toast.error('Failed to update feature flag', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setFeatureMutationId(null)
    }
  }

  const handleSaveFeature = async (feature: Partial<FeatureFlag>) => {
    const featureId = feature.id || 'new'
    setFeatureMutationId(featureId)

    try {
      const method = feature.id ? 'PATCH' : 'POST'
      const url = feature.id ? `/api/pricing/features/${feature.id}` : '/api/pricing/features'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feature),
      })

      if (!res.ok) {
        const details = await res.json().catch(() => null)
        throw new Error(details?.error || 'Failed to save feature')
      }

      toast.success(feature.id ? 'Feature updated' : 'Feature created')
      setShowNewFeatureForm(false)
      await loadPricingData()
    } catch (error) {
      console.error('Failed to save feature:', error)
      toast.error('Failed to save feature flag', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setFeatureMutationId(null)
    }
  }

  const handleSaveConfig = async (configId: string, value: any) => {
    setConfigSavingId(configId)

    try {
      const res = await fetch(`/api/pricing/configs/${configId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      })

      if (!res.ok) {
        const details = await res.json().catch(() => null)
        throw new Error(details?.error || 'Failed to save configuration')
      }

      const updatedConfig = await res.json().catch(() => null)
      const nextValue = updatedConfig?.value ?? value

      setConfigs(prev =>
        prev.map(c =>
          c.id === configId ? { ...c, value: nextValue } : c
        )
      )

      toast.success('Configuration saved')
    } catch (error) {
      console.error('Failed to save config:', error)
      toast.error('Failed to save pricing configuration', {
        description: error instanceof Error ? error.message : undefined,
      })
      await loadPricingData()
    } finally {
      setConfigSavingId(null)
    }
  }

  const TierForm = ({ tier, onSave, onCancel, isSubmitting }: {
    tier?: PricingTier,
    onSave: (tier: Partial<PricingTier>) => Promise<void> | void,
    onCancel: () => void,
    isSubmitting: boolean
  }) => {
    const [formData, setFormData] = useState<Partial<PricingTier>>(
      tier || {
        name: '',
        slug: '',
        description: '',
        price_cents: 0,
        currency: 'usd',
        interval: 'monthly',
        interval_count: 1,
        features: [],
        is_active: true,
        is_default: false
      }
    )
    const [featureInput, setFeatureInput] = useState('')
    const handleSubmit = async () => {
      await onSave(formData)
    }

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <input
              type="text"
              value={formData.slug || ''}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={(formData.price_cents || 0) / 100}
                onChange={(e) => {
                  const priceValue = parseFloat(e.target.value)
                  setFormData({
                    ...formData,
                    price_cents: Number.isNaN(priceValue) ? 0 : Math.round(priceValue * 100),
                  })
                }}
                step="0.01"
                className="w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Interval</label>
            <select
              value={formData.interval || 'monthly'}
              onChange={(e) => setFormData({ ...formData, interval: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="one_time">One Time</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Price ID (Live)</label>
            <input
              type="text"
              value={formData.stripe_price_id || ''}
              onChange={(e) => setFormData({ ...formData, stripe_price_id: e.target.value })}
              placeholder="price_..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Price ID (Test)</label>
            <input
              type="text"
              value={formData.stripe_test_price_id || ''}
              onChange={(e) => setFormData({ ...formData, stripe_test_price_id: e.target.value })}
              placeholder="price_..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Features</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && featureInput.trim()) {
                    setFormData({
                      ...formData,
                      features: [...(formData.features || []), featureInput.trim()]
                    })
                    setFeatureInput('')
                  }
                }}
                placeholder="Type a feature and press Enter"
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              {(formData.features || []).map((feature, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                  <span className="text-sm">{feature}</span>
                  <button
                    onClick={() => {
                      const newFeatures = [...(formData.features || [])]
                      newFeatures.splice(index, 1)
                      setFormData({ ...formData, features: newFeatures })
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 flex items-center gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active || false}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_default || false}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">Default Tier</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? 'Saving...' : 'Save Tier'}
          </button>
        </div>
      </div>
    )
  }

  const FeatureForm = ({ onSave, onCancel, isSubmitting }: {
    onSave: (feature: Partial<FeatureFlag>) => Promise<void> | void,
    onCancel: () => void,
    isSubmitting: boolean
  }) => {
    const [formState, setFormState] = useState<{
      name: string
      key: string
      description: string
      type: FeatureFlag['type']
      rollout_percentage: number
      is_active: boolean
    }>({
      name: '',
      key: '',
      description: '',
      type: 'boolean',
      rollout_percentage: 100,
      is_active: true,
    })

    const [defaultValueInput, setDefaultValueInput] = useState('false')
    const [tierOverridesInput, setTierOverridesInput] = useState('{}')

    const handleTypeChange = (value: FeatureFlag['type']) => {
      setFormState({ ...formState, type: value })
      if (value === 'boolean') {
        setDefaultValueInput('false')
      } else if (value === 'number') {
        setDefaultValueInput('0')
      } else if (value === 'json') {
        setDefaultValueInput('{}')
      } else {
        setDefaultValueInput('')
      }
    }

    const parseDefaultValue = () => {
      if (formState.type === 'boolean') {
        return defaultValueInput === 'true'
      }
      if (formState.type === 'number') {
        const parsed = parseFloat(defaultValueInput)
        if (Number.isNaN(parsed)) {
          throw new Error('Default value must be a number')
        }
        return parsed
      }
      if (formState.type === 'json') {
        try {
          const parsed = JSON.parse(defaultValueInput || '{}')
          if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('JSON default value must be an object')
          }
          return parsed
        } catch (error) {
          throw new Error('Default value must be valid JSON')
        }
      }
      return defaultValueInput
    }

    const handleSubmit = async () => {
      if (!formState.name.trim() || !formState.key.trim()) {
        toast.error('Name and key are required')
        return
      }

      let defaultValue: any
      try {
        defaultValue = parseDefaultValue()
      } catch (error) {
        toast.error((error as Error).message)
        return
      }

      let tierOverrides: Record<string, any> = {}
      if (tierOverridesInput.trim()) {
        try {
          const parsedOverrides = JSON.parse(tierOverridesInput)
          if (typeof parsedOverrides === 'object' && parsedOverrides !== null) {
            tierOverrides = parsedOverrides
          } else {
            throw new Error()
          }
        } catch {
          toast.error('Tier overrides must be valid JSON')
          return
        }
      }

      const description = formState.description.trim()

      await onSave({
        name: formState.name.trim(),
        key: formState.key.trim(),
        description: description || undefined,
        type: formState.type,
        default_value: defaultValue,
        rollout_percentage: Math.min(
          100,
          Math.max(0, Number(formState.rollout_percentage) || 0)
        ),
        is_active: formState.is_active,
        tier_overrides: tierOverrides,
      })
    }

    return (
      <div className="bg-gray-50 border rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
            <input
              type="text"
              value={formState.key}
              onChange={(e) => setFormState({ ...formState, key: e.target.value })}
              placeholder="e.g. builder.custom_voice"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={formState.description}
              onChange={(e) => setFormState({ ...formState, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formState.type}
              onChange={(e) => handleTypeChange(e.target.value as FeatureFlag['type'])}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="boolean">Boolean</option>
              <option value="number">Number</option>
              <option value="string">String</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Value</label>
            {formState.type === 'boolean' ? (
              <select
                value={defaultValueInput}
                onChange={(e) => setDefaultValueInput(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            ) : formState.type === 'json' ? (
              <textarea
                rows={3}
                value={defaultValueInput}
                onChange={(e) => setDefaultValueInput(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            ) : (
              <input
                type={formState.type === 'number' ? 'number' : 'text'}
                value={defaultValueInput}
                onChange={(e) => setDefaultValueInput(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rollout %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={formState.rollout_percentage}
              onChange={(e) =>
                setFormState({ ...formState, rollout_percentage: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="feature-active"
              type="checkbox"
              checked={formState.is_active}
              onChange={(e) => setFormState({ ...formState, is_active: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="feature-active" className="text-sm font-medium text-gray-700">
              Active immediately
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tier Overrides (JSON)
            </label>
            <textarea
              rows={3}
              value={tierOverridesInput}
              onChange={(e) => setTierOverridesInput(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder='e.g. { "pro": true }'
            />
            <p className="text-xs text-gray-500 mt-1">
              Provide overrides keyed by tier slug (e.g. {'{ "pro": true }'}).
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? 'Saving...' : 'Save Feature'}
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading pricing data...</p>
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
          Manage subscription tiers, feature flags, and pricing configurations
        </p>
        {isRefreshing && (
          <div className="flex items-center gap-2 text-sm text-blue-600 mt-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Syncing latest pricing data...
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('tiers')}
              className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${
                activeTab === 'tiers'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Package className="h-4 w-4" />
              Pricing Tiers
            </button>
            <button
              onClick={() => setActiveTab('features')}
              className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${
                activeTab === 'features'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ToggleLeft className="h-4 w-4" />
              Feature Flags
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${
                activeTab === 'config'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <DollarSign className="h-4 w-4" />
              Configuration
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Pricing Tiers Tab */}
          {activeTab === 'tiers' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Subscription Tiers</h2>
                <button
                  onClick={() => setShowNewTierForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Tier
                </button>
              </div>

              {showNewTierForm && (
                <TierForm
                  onSave={handleSaveTier}
                  onCancel={() => setShowNewTierForm(false)}
                  isSubmitting={tierMutationLoading}
                />
              )}

              <div className="space-y-4">
                {tiers.map((tier, index) => (
                  <div key={tier.id}>
                    {editingTier === tier.id ? (
                      <TierForm
                        tier={tier}
                        onSave={handleSaveTier}
                        onCancel={() => setEditingTier(null)}
                        isSubmitting={tierMutationLoading}
                      />
                    ) : (
                      <div className="bg-white border rounded-lg p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-4">
                              <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
                              {tier.is_default && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                  Default
                                </span>
                              )}
                              {!tier.is_active && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <p className="text-gray-600 mt-1">{tier.description}</p>
                            <div className="flex items-center gap-6 mt-3">
                              <div className="text-2xl font-bold text-gray-900">
                                ${(tier.price_cents / 100).toFixed(2)}
                                {tier.interval !== 'one_time' && (
                                  <span className="text-sm font-normal text-gray-500">/{tier.interval}</span>
                                )}
                              </div>
                              {tier.subscriber_count !== undefined && (
                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                  <Users className="h-4 w-4" />
                                  {tier.active_subscribers || 0} active / {tier.subscriber_count} total
                                </div>
                              )}
                            </div>
                            {tier.features && tier.features.length > 0 && (
                              <ul className="mt-4 space-y-2">
                                {tier.features.map((feature, idx) => (
                                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                                    <Check className="h-4 w-4 text-green-500" />
                                    {feature}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleReorderTier(tier.id, 'up')}
                              disabled={index === 0 || !!tierReorderId}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleReorderTier(tier.id, 'down')}
                              disabled={index === tiers.length - 1 || !!tierReorderId}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingTier(tier.id)}
                              className="p-1 text-blue-600 hover:text-blue-700"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTier(tier.id)}
                              disabled={tierDeleteId === tier.id}
                              className="p-1 text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature Flags Tab */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Feature Flags</h2>
                <button
                  onClick={() => setShowNewFeatureForm(true)}
                  disabled={showNewFeatureForm}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 ${
                    showNewFeatureForm ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Add Feature
                </button>
              </div>

              <div className="space-y-4">
                {showNewFeatureForm && (
                  <FeatureForm
                    onSave={handleSaveFeature}
                    onCancel={() => setShowNewFeatureForm(false)}
                    isSubmitting={featureMutationId === 'new'}
                  />
                )}

                {features.map((feature) => (
                  <div key={feature.id} className="bg-white border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-gray-900">{feature.name}</h3>
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            {feature.type}
                          </span>
                          {feature.rollout_percentage < 100 && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                              {feature.rollout_percentage}% rollout
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-gray-500">Key: {feature.key}</span>
                          <span className="text-xs text-gray-500">
                            Default: {JSON.stringify(feature.default_value)}
                          </span>
                        </div>
                        {feature.tier_overrides && Object.keys(feature.tier_overrides).length > 0 && (
                          <pre className="mt-3 bg-gray-50 border border-gray-100 rounded p-3 text-xs text-gray-600 overflow-auto">
                            {JSON.stringify(feature.tier_overrides, null, 2)}
                          </pre>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleFeature(feature.id, !feature.is_active)}
                        disabled={featureMutationId === feature.id}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          feature.is_active ? 'bg-blue-600' : 'bg-gray-200'
                        } ${featureMutationId === feature.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            feature.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Configuration Tab */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Pricing Configuration</h2>

              {/* Group configs by category */}
              {Object.entries(
                configs.reduce((acc, config) => {
                  if (!acc[config.category]) acc[config.category] = []
                  acc[config.category].push(config)
                  return acc
                }, {} as Record<string, PricingConfig[]>)
              ).map(([category, categoryConfigs]) => (
                <div key={category} className="space-y-4">
                  <h3 className="font-medium text-gray-900 capitalize">
                    {category.replace(/_/g, ' ')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categoryConfigs.map((config) => {
                      const isSaving = configSavingId === config.id
                      const numericValue = Number(config.value ?? 0)

                      return (
                        <div key={config.id} className="bg-white border rounded-lg p-4">
                          <div className="mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              {config.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </label>
                            {config.description && (
                              <p className="text-xs text-gray-500 mt-1">{config.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {config.key.includes('cents') ? (
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                                <input
                                  type="number"
                                  value={numericValue / 100}
                                  onChange={(e) => {
                                    const cents = Math.round((parseFloat(e.target.value) || 0) * 100)
                                    updateConfigLocalValue(config.id, cents)
                                  }}
                                  onBlur={(e) => {
                                    const cents = Math.round((parseFloat(e.target.value) || 0) * 100)
                                    handleSaveConfig(config.id, cents)
                                  }}
                                  step="0.01"
                                  disabled={isSaving}
                                  className="w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                />
                              </div>
                            ) : config.key.includes('percentage') || config.key.includes('percent') ? (
                              <div className="relative flex-1">
                                <input
                                  type="number"
                                  value={numericValue}
                                  onChange={(e) => {
                                    const percentage = parseFloat(e.target.value) || 0
                                    updateConfigLocalValue(config.id, percentage)
                                  }}
                                  onBlur={(e) => {
                                    const percentage = parseFloat(e.target.value) || 0
                                    handleSaveConfig(config.id, percentage)
                                  }}
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  disabled={isSaving}
                                  className="w-full pr-8 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                />
                                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                              </div>
                            ) : config.key.includes('days') ? (
                              <div className="relative flex-1">
                                <input
                                  type="number"
                                  value={numericValue}
                                  onChange={(e) => {
                                    const days = parseInt(e.target.value) || 0
                                    updateConfigLocalValue(config.id, days)
                                  }}
                                  onBlur={(e) => {
                                    const days = parseInt(e.target.value) || 0
                                    handleSaveConfig(config.id, days)
                                  }}
                                  min="1"
                                  disabled={isSaving}
                                  className="w-full pr-12 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                />
                                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">days</span>
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={config.value ?? ''}
                                onChange={(e) => updateConfigLocalValue(config.id, e.target.value)}
                                onBlur={(e) => handleSaveConfig(config.id, e.target.value)}
                                disabled={isSaving}
                                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Important Note</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Changes to pricing configurations will affect all new transactions.
                      Existing subscriptions will continue with their current pricing until renewed.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
