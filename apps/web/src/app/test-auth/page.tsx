'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@mindscript/auth/hooks';

export default function TestAuthPage() {
  const { user, session, loading } = useAuth();
  const [loadTime, setLoadTime] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setLoadTime(Math.floor((Date.now() - start) / 1000));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Auth Debug Page</h1>

      <div className="space-y-4">
        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">Loading State</h2>
          <p>Loading: {loading ? '✅ TRUE (stuck)' : '❌ FALSE (good)'}</p>
          <p>Time elapsed: {loadTime} seconds</p>
        </div>

        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">User State</h2>
          <p>User: {user ? `✅ ${user.email || user.id}` : '❌ Not authenticated'}</p>
        </div>

        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">Session State</h2>
          <p>Session: {session ? '✅ Active' : '❌ No session'}</p>
          {session && (
            <p className="text-sm text-gray-600 mt-1">
              Expires: {new Date(session.expires_at! * 1000).toLocaleString()}
            </p>
          )}
        </div>

        <div className="p-4 border rounded bg-yellow-50">
          <h2 className="font-semibold mb-2">Console Output</h2>
          <p className="text-sm">Check browser console for auth errors</p>
        </div>

        {loading && loadTime > 10 && (
          <div className="p-4 border-2 border-red-500 rounded bg-red-50">
            <h2 className="font-semibold text-red-700">⚠️ Auth Timeout Issue Detected</h2>
            <p className="text-red-600">Loading has been stuck for {loadTime} seconds</p>
            <p className="text-sm text-red-500 mt-2">This indicates the auth hook is hanging</p>
          </div>
        )}

        {!loading && (
          <div className="p-4 border-2 border-green-500 rounded bg-green-50">
            <h2 className="font-semibold text-green-700">✅ Auth Hook Working</h2>
            <p className="text-green-600">Loading completed in ~{loadTime} seconds</p>
          </div>
        )}
      </div>
    </div>
  );
}