'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthForm, OAuthButtons, type AuthFormField } from '@mindscript/ui';
import { createClient } from '../../../lib/supabase/client';

const loginFields: AuthFormField[] = [
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    placeholder: 'you@example.com',
    required: true,
    autoComplete: 'email',
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: '••••••••',
    required: true,
    autoComplete: 'current-password',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  const handleLogin = async (data: Record<string, string>) => {
    console.log('Login attempt started', data.email);
    setLoading(true);
    setError(null);

    try {
      // Try server-side auth first as a workaround for browser timeout issues
      console.log('Attempting server-side auth...');
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Authentication failed');
      }

      console.log('Server auth successful, establishing session...');

      // Now try to establish the session client-side
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session) {
        // If no session, try to sign in again client-side with a shorter timeout
        console.log('No session found, attempting client-side auth...');
        const loginPromise = supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Client auth timeout')), 3000)
        );

        try {
          const { data: authData, error } = await Promise.race([
            loginPromise,
            timeoutPromise
          ]).catch(err => ({ data: null, error: err })) as any;

          if (authData?.user) {
            console.log('Client auth successful, redirecting to:', redirectTo);
            window.location.href = redirectTo;
            return;
          }
        } catch (clientError) {
          console.log('Client auth failed, but server auth succeeded');
          // Server auth worked, so we can still redirect
          window.location.href = redirectTo;
          return;
        }
      }

      console.log('Login successful, redirecting to:', redirectTo);
      window.location.href = redirectTo;
    } catch (error: any) {
      console.error('Caught error:', error);
      setError(error.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('OAuth error:', error);
      setError(error.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              MindScript
            </h1>
            <p className="text-gray-600 mt-2">Welcome back</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <AuthForm
            title="Sign in to your account"
            fields={loginFields}
            submitLabel="Sign in"
            onSubmit={handleLogin}
            loading={loading}
            footer={
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or continue with</span>
                  </div>
                </div>

                <OAuthButtons
                  onGoogleClick={handleGoogleLogin}
                  loading={loading}
                />

                <div className="mt-6 text-center text-sm">
                  <Link 
                    href="/auth/reset-password"
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    Forgot your password?
                  </Link>
                </div>

                <div className="mt-6 text-center text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link 
                    href="/auth/signup"
                    className="text-indigo-600 hover:text-indigo-500 font-medium"
                  >
                    Sign up
                  </Link>
                </div>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}