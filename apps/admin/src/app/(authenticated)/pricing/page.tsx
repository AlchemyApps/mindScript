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
  Users
} from 'lucide-react'

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
  const [editingTier, setEditingTier] = useState<string | null>(null)
  const [editingFeature, setEditingFeature] = useState<string | null>(null)
  const [showNewTierForm, setShowNewTierForm] = useState(false)
  const [showNewFeatureForm, setShowNewFeatureForm] = useState(false)

  // Load data on mount
  useEffect(() => {
    loadPricingData()
  }, [])

  const loadPricingData = async () => {
    try {
      const [tiersRes, featuresRes, configsRes] = await Promise.all([
        fetch('/api/pricing/tiers'),
        fetch('/api/pricing/features'),
        fetch('/api/pricing/configs')
      ])

      if (tiersRes.ok) {
        const tiersData = await tiersRes.json()
        setTiers(tiersData)
      }

      if (featuresRes.ok) {
        const featuresData = await featuresRes.json()
        setFeatures(featuresData)
      }

      if (configsRes.ok) {
        const configsData = await configsRes.json()
        setConfigs(configsData)
      }
    } catch (error) {
      console.error('Failed to load pricing data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveTier = async (tier: Partial<PricingTier>) => {
    try {
      const method = tier.id ? 'PUT' : 'POST'
      const url = tier.id ? `/api/pricing/tiers/${tier.id}` : '/api/pricing/tiers'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tier)
      })

      if (res.ok) {
        await loadPricingData()
        setEditingTier(null)
        setShowNewTierForm(false)
      }
    } catch (error) {
      console.error('Failed to save tier:', error)
    }
  }

  const handleDeleteTier = async (tierId: string) => {
    if (!confirm('Are you sure you want to delete this tier?')) return

    try {
      const res = await fetch(`/api/pricing/tiers/${tierId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await loadPricingData()
      }
    } catch (error) {
      console.error('Failed to delete tier:', error)
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

    try {
      await fetch('/api/pricing/tiers/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      setTiers(newTiers)
    } catch (error) {
      console.error('Failed to reorder tiers:', error)
    }
  }

  const handleToggleFeature = async (featureId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/pricing/features/${featureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive })
      })

      if (res.ok) {
        setFeatures(features.map(f =>
          f.id === featureId ? { ...f, is_active: isActive } : f
        ))
      }
    } catch (error) {
      console.error('Failed to toggle feature:', error)
    }
  }

  const handleSaveConfig = async (configId: string, value: any) => {
    try {
      const res = await fetch(`/api/pricing/configs/${configId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      })

      if (res.ok) {
        setConfigs(configs.map(c =>
          c.id === configId ? { ...c, value } : c
        ))
      }
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  const TierForm = ({ tier, onSave, onCancel }: {
    tier?: PricingTier,
    onSave: (tier: Partial<PricingTier>) => void,
    onCancel: () => void
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
                onChange={(e) => setFormData({ ...formData, price_cents: Math.round(parseFloat(e.target.value) * 100) })}
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
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Tier
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
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleReorderTier(tier.id, 'down')}
                              disabled={index === tiers.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
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
                              className="p-1 text-red-600 hover:text-red-700"
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Feature
                </button>
              </div>

              <div className="space-y-4">
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
                      </div>
                      <button
                        onClick={() => handleToggleFeature(feature.id, !feature.is_active)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          feature.is_active ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
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
                    {categoryConfigs.map((config) => (
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
                                value={config.value / 100}
                                onChange={(e) => handleSaveConfig(config.id, Math.round(parseFloat(e.target.value) * 100))}
                                step="0.01"
                                className="w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          ) : config.key.includes('percentage') || config.key.includes('percent') ? (
                            <div className="relative flex-1">
                              <input
                                type="number"
                                value={config.value}
                                onChange={(e) => handleSaveConfig(config.id, parseFloat(e.target.value))}
                                step="0.1"
                                min="0"
                                max="100"
                                className="w-full pr-8 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">%</span>
                            </div>
                          ) : config.key.includes('days') ? (
                            <div className="relative flex-1">
                              <input
                                type="number"
                                value={config.value}
                                onChange={(e) => handleSaveConfig(config.id, parseInt(e.target.value))}
                                min="1"
                                className="w-full pr-12 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">days</span>
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={config.value}
                              onChange={(e) => handleSaveConfig(config.id, e.target.value)}
                              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      </div>
                    ))}
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