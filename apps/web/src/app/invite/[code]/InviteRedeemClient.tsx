'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@mindscript/auth/client';

interface Props {
  code: string;
  tier: string;
  email: string;
}

export function InviteRedeemClient({ code, tier, email }: Props) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);

        // Auto-redeem if coming back from auth with cookie
        if (currentUser) {
          const storedCode = document.cookie
            .split('; ')
            .find(row => row.startsWith('ff_invite_code='))
            ?.split('=')[1];

          if (storedCode === code) {
            // Clear the cookie
            document.cookie = 'ff_invite_code=; path=/; max-age=0';
            // Auto-redeem
            await handleRedeem(currentUser);
          }
        }
      } catch {
        // Not authenticated
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [code]);

  const handleRedeem = async (redeemUser?: any) => {
    const currentUser = redeemUser || user;
    if (!currentUser) return;

    setRedeeming(true);
    setError(null);

    try {
      const response = await fetch('/api/ff/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to redeem invite');
      }

      setRedeemed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redeem invite');
    } finally {
      setRedeeming(false);
    }
  };

  const handleSignUpAndRedeem = () => {
    // Store the invite code in a cookie so we can auto-redeem after signup
    document.cookie = `ff_invite_code=${code}; path=/; max-age=3600; SameSite=Lax`;
    window.location.href = `/auth/signup?redirectTo=/invite/${code}&email=${encodeURIComponent(email)}`;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (redeemed) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#10B981" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re In!</h2>
        <p className="text-gray-600 mb-6">
          Your {tier === 'inner_circle' ? 'Inner Circle' : 'Cost Pass'} access is now active.
        </p>
        <a
          href="/builder"
          className="inline-block px-8 py-3 bg-[#6C63FF] text-white rounded-lg font-semibold hover:bg-[#5b54e6] transition-colors"
        >
          Start Creating
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => handleRedeem()}
          className="px-6 py-3 bg-[#6C63FF] text-white rounded-lg font-semibold hover:bg-[#5b54e6] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (user) {
    return (
      <div className="text-center">
        <p className="text-gray-600 mb-4">
          Signed in as <strong>{user.email}</strong>
        </p>
        <button
          onClick={() => handleRedeem()}
          disabled={redeeming}
          className="w-full px-6 py-3 bg-[#6C63FF] text-white rounded-lg font-semibold hover:bg-[#5b54e6] transition-colors disabled:opacity-50"
        >
          {redeeming ? 'Activating...' : 'Activate My Access'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleSignUpAndRedeem}
        className="w-full px-6 py-3 bg-[#6C63FF] text-white rounded-lg font-semibold hover:bg-[#5b54e6] transition-colors"
      >
        Sign Up to Activate
      </button>
      <a
        href={`/auth/login?redirectTo=/invite/${code}&email=${encodeURIComponent(email)}`}
        className="block w-full px-6 py-3 border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-center"
      >
        Already have an account? Sign In
      </a>
    </div>
  );
}
