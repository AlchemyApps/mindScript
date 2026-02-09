'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthForm, OAuthButtons, type AuthFormField } from '@mindscript/ui';
import { getSupabaseBrowserClient } from '@mindscript/auth/client';

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefilledEmail = searchParams.get('email') || '';
  const redirectTo = searchParams.get('redirectTo') || '';

  const signupFields: AuthFormField[] = [
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'you@example.com',
      required: true,
      autoComplete: 'email',
      ...(prefilledEmail ? { defaultValue: prefilledEmail, disabled: true } : {}),
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

  const handleSignup = async (data: Record<string, string>) => {
    setLoading(true);
    setError(null);

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

      // If session exists (email confirmation disabled), redirect immediately
      if (authData?.session) {
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.push('/dashboard');
        }
        return;
      }

      // Fallback: redirect to dashboard (shouldn't reach here with confirmation disabled)
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.push('/dashboard');
      }
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
          redirectTo: `${window.location.origin}/auth/callback${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('OAuth error:', error);
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