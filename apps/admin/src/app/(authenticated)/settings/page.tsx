'use client'

import { useState } from 'react'
import { Settings, DollarSign, ToggleLeft, Mail, Shield, Database, Globe, Save } from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'pricing' | 'features' | 'email' | 'security' | 'system'>('pricing')
  const [hasChanges, setHasChanges] = useState(false)

  // Pricing settings state
  const [pricing, setPricing] = useState({
    webIntroPrice: 100, // cents
    webStandardPrice: 300,
    nativeIntroPrice: 99,
    nativeStandardPrice: 299,
    backgroundMusicBase: 100,
    solfeggioAddon: 50,
    binauralAddon: 50,
    platformFeePercent: 15,
    minPayoutAmount: 1000, // $10 in cents
  })

  // Feature flags state
  const [features, setFeatures] = useState({
    enableMarketplace: true,
    enableSellerSignup: true,
    enableVoiceCloning: false,
    enableMobileApp: true,
    enableEmailNotifications: true,
    enableWebhooks: true,
    maintenanceMode: false,
  })

  const handleSave = () => {
    // Here you would save to the database
    console.log('Saving settings...', { pricing, features })
    setHasChanges(false)
  }

  const tabs = [
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'features', label: 'Features', icon: ToggleLeft },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'system', label: 'System', icon: Database },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Settings className="h-8 w-8" />
          Platform Settings
        </h1>
        <p className="text-gray-600 mt-2">
          Configure platform-wide settings and feature flags
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-3 text-sm font-medium flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-6">
          {/* Pricing Tab */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Pricing Configuration</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Web Pricing</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Intro Price (First Track)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={pricing.webIntroPrice / 100}
                          onChange={(e) => {
                            setPricing({ ...pricing, webIntroPrice: Math.round(parseFloat(e.target.value) * 100) })
                            setHasChanges(true)
                          }}
                          step="0.01"
                          className="w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Standard Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={pricing.webStandardPrice / 100}
                          onChange={(e) => {
                            setPricing({ ...pricing, webStandardPrice: Math.round(parseFloat(e.target.value) * 100) })
                            setHasChanges(true)
                          }}
                          step="0.01"
                          className="w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Native App Pricing</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Intro Price (First Track)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={pricing.nativeIntroPrice / 100}
                          onChange={(e) => {
                            setPricing({ ...pricing, nativeIntroPrice: Math.round(parseFloat(e.target.value) * 100) })
                            setHasChanges(true)
                          }}
                          step="0.01"
                          className="w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Standard Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={pricing.nativeStandardPrice / 100}
                          onChange={(e) => {
                            setPricing({ ...pricing, nativeStandardPrice: Math.round(parseFloat(e.target.value) * 100) })
                            setHasChanges(true)
                          }}
                          step="0.01"
                          className="w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Add-on Pricing</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Background Music Base
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={pricing.backgroundMusicBase / 100}
                          onChange={(e) => {
                            setPricing({ ...pricing, backgroundMusicBase: Math.round(parseFloat(e.target.value) * 100) })
                            setHasChanges(true)
                          }}
                          step="0.01"
                          className="w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Solfeggio Frequency Add-on
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={pricing.solfeggioAddon / 100}
                          onChange={(e) => {
                            setPricing({ ...pricing, solfeggioAddon: Math.round(parseFloat(e.target.value) * 100) })
                            setHasChanges(true)
                          }}
                          step="0.01"
                          className="w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Platform Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Platform Fee (%)
                      </label>
                      <input
                        type="number"
                        value={pricing.platformFeePercent}
                        onChange={(e) => {
                          setPricing({ ...pricing, platformFeePercent: parseInt(e.target.value) })
                          setHasChanges(true)
                        }}
                        min="0"
                        max="100"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Minimum Payout Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={pricing.minPayoutAmount / 100}
                          onChange={(e) => {
                            setPricing({ ...pricing, minPayoutAmount: Math.round(parseFloat(e.target.value) * 100) })
                            setHasChanges(true)
                          }}
                          step="0.01"
                          className="w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Features Tab */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Feature Flags</h2>

              <div className="space-y-4">
                {Object.entries(features).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {key === 'maintenanceMode'
                          ? 'Enable maintenance mode to prevent user access'
                          : `Toggle ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFeatures({ ...features, [key]: !value })
                        setHasChanges(true)
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        value ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          value ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Email Configuration</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  Email templates and SMTP settings would be configured here. This feature requires Resend API integration.
                </p>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Security Settings</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  Security settings including rate limiting, IP allowlists, and API key management would be configured here.
                </p>
              </div>
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">System Configuration</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  System settings including database connections, cache configuration, and job queue settings would be configured here.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  // Reset changes
                  setHasChanges(false)
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}