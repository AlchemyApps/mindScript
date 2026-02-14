'use client';

import { useState } from 'react';

export default function DeleteAccountPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // First sign in to get a session
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !signInData.session) {
        setResult({ success: false, message: 'Invalid email or password.' });
        return;
      }

      // Call the delete account API
      const response = await fetch('/api/profile/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${signInData.session.access_token}`,
        },
        body: JSON.stringify({
          password,
          confirm: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({ success: false, message: data.error ?? 'Failed to delete account.' });
        return;
      }

      setResult({
        success: true,
        message: data.message ?? 'Account scheduled for deletion. Check your email for confirmation.',
      });
    } catch {
      setResult({ success: false, message: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Delete Your Account</h1>
      <p className="text-gray-600 mb-6">
        This will schedule your MindScript account for deletion. After 30 days, all
        your data will be permanently removed. You can cancel by logging back in.
      </p>

      {result ? (
        <div
          className={`p-4 rounded-lg mb-4 ${
            result.success
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {result.message}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="your@email.com"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong>Warning:</strong> This action will schedule your account for permanent
            deletion after 30 days. You can cancel by logging back in during the grace period.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Processing...' : 'Delete My Account'}
          </button>
        </form>
      )}
    </div>
  );
}
