'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthForm, OAuthButtons, type AuthFormField } from '@mindscript/ui';
import { useAuth } from '@mindscript/auth/hooks';
import { getSupabaseBrowserClient } from '@mindscript/auth/client';

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
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseBrowserClient();

  const handleLogin = async (data: Record<string, string>) => {
    await signIn({
      email: data.email,
      password: data.password,
    });
    router.push('/dashboard');
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
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

          <AuthForm
            title="Sign in to your account"
            fields={loginFields}
            submitLabel="Sign in"
            onSubmit={handleLogin}
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