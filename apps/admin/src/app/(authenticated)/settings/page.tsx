'use client'

import { useState } from 'react'
import { Settings, ToggleLeft, Mail, Shield, Database, Info } from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'features' | 'email' | 'security' | 'system'>('features')

  // Feature flags state (read-only display)
  const [features] = useState({
    enableMarketplace: true,
    enableSellerSignup: true,
    enableVoiceCloning: false,
    enableMobileApp: true,
    enableEmailNotifications: true,
    enableWebhooks: true,
    maintenanceMode: false,
  })

  const tabs = [
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
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
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
          {/* Features Tab */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Feature Flags</h2>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Feature flags are not yet connected to the application. Changes here are for display purposes only. Pricing is managed on the <a href="/pricing" className="underline font-medium">Pricing</a> page.
                </p>
              </div>

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
                    <div
                      className={`relative inline-flex h-6 w-11 items-center rounded-full opacity-60 cursor-not-allowed ${
                        value ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          value ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </div>
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
                  Coming Soon — Email templates and SMTP settings will be configured here once Resend API integration is complete.
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
                  Coming Soon — Security settings including rate limiting, IP allowlists, and API key management will be configured here.
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
                  Coming Soon — System settings including database connections, cache configuration, and job queue settings will be configured here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
