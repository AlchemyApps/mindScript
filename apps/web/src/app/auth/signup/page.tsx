'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthForm, OAuthButtons, EmailVerificationBanner, type AuthFormField } from '@mindscript/ui';
import { getSupabaseBrowserClient } from '@mindscript/auth/client';

const signupFields: AuthFormField[] = [
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    placeholder: 'you@example.com',
    required: true,
    autoComplete: 'email',
  },
  {
    name: 'displayName',
    label: 'Display Name',
    type: 'text',
    placeholder: 'John Doe',
    required: false,
    autoComplete: 'name',
  },
  {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: '••••••••',
    required: true,
    autoComplete: 'new-password',
  },
  {
    name: 'confirmPassword',
    label: 'Confirm Password',
    type: 'password',
    placeholder: '••••••••',
    required: true,
    autoComplete: 'new-password',
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (data: Record<string, string>) => {
    setLoading(true);
    setError(null);
    setUserEmail(data.email);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            display_name: data.displayName,
          },
        },
      });

      if (error) throw error;

      setVerificationSent(true);
    } catch (error: any) {
      setError(error.message || 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('OAuth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: userEmail,
    });
    if (error) throw error;
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
              <p className="mt-2 text-sm text-gray-600">
                We've sent you a verification link
              </p>
            </div>

            <EmailVerificationBanner
              email={userEmail}
              onResend={handleResendVerification}
            />

            <div className="mt-6 text-center">
              <Link 
                href="/auth/login"
                className="text-indigo-600 hover:text-indigo-500 text-sm"
              >
                Back to login
              </Link>
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
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              MindScript
            </h1>
            <p className="text-gray-600 mt-2">Create your account</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <AuthForm
            title="Sign up for MindScript"
            subtitle="Start creating AI-powered audio affirmations"
            fields={signupFields}
            submitLabel="Create account"
            onSubmit={handleSignup}
            loading={loading}
            showPasswordStrength={true}
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
                  onGoogleClick={handleGoogleSignup}
                  loading={loading}
                />

                <div className="mt-6 text-center text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link 
                    href="/auth/login"
                    className="text-indigo-600 hover:text-indigo-500 font-medium"
                  >
                    Sign in
                  </Link>
                </div>

                <div className="mt-4 text-center text-xs text-gray-500">
                  By signing up, you agree to our{' '}
                  <Link href="/terms" className="text-indigo-600 hover:text-indigo-500">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-indigo-600 hover:text-indigo-500">
                    Privacy Policy
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