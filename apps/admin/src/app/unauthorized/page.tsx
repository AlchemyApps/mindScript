'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShieldAlert, Home, LogIn } from 'lucide-react'

function UnauthorizedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')

  const reasonCopy: Record<string, string> = {
    not_admin: "Your account doesn't have the admin role assigned.",
    inactive: 'This admin account is currently inactive. Please contact support.',
    role_error: 'We could not verify your admin privileges. Please try again.',
  }

  const message =
    (reason && reasonCopy[reason]) ||
    "You don't have permission to access the admin portal. This area is restricted to authorized administrators only."

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="flex justify-center mb-6">
            <div className="bg-red-500/20 p-4 rounded-full">
              <ShieldAlert className="w-12 h-12 text-red-400" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white text-center mb-2">
            Access Denied
          </h1>

          <p className="text-gray-300 text-center mb-8">
            {message}
          </p>

          <div className="space-y-4">
            <button
              onClick={() => router.push('/')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/20"
            >
              <Home className="w-5 h-5" />
              Return to Home
            </button>

            <button
              onClick={() => router.push('/login')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
            >
              <LogIn className="w-5 h-5" />
              Sign In with Different Account
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-sm text-gray-400 text-center">
              If you believe this is an error, please contact your system administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <ShieldAlert className="w-12 h-12 text-red-400 animate-pulse" />
      </div>
    }>
      <UnauthorizedContent />
    </Suspense>
  )
}
