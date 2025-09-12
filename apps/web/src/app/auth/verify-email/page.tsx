'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Spinner } from '@mindscript/ui';
import { getSupabaseBrowserClient } from '@mindscript/auth/client';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const token = searchParams.get('token');
        const type = searchParams.get('type');
        
        if (!token || type !== 'email') {
          setError('Invalid verification link');
          setVerifying(false);
          return;
        }

        // The token verification is handled by the Supabase auth callback
        // Check if user is already verified
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user?.email_confirmed_at) {
          // Email already verified, redirect to dashboard
          router.push('/dashboard');
        } else {
          setError('Verification failed. Please try again or contact support.');
        }
      } catch (err) {
        console.error('Verification error:', err);
        setError('An error occurred during verification');
      } finally {
        setVerifying(false);
      }
    };

    verifyEmail();
  }, [searchParams, supabase, router]);

  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center">
              <Spinner className="mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Verifying your email...</h2>
              <p className="mt-2 text-sm text-gray-600">
                Please wait while we confirm your email address
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Verification failed</h2>
              <p className="mt-2 text-sm text-gray-600">{error}</p>
              
              <div className="mt-6 space-y-3">
                <Link 
                  href="/auth/signup"
                  className="block w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Try signing up again
                </Link>
                <Link 
                  href="/auth/login"
                  className="block w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back to login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Email verified!</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your email has been successfully verified
            </p>
            
            <div className="mt-6">
              <Link 
                href="/dashboard"
                className="block w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}