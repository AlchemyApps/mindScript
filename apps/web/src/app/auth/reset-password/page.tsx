'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthForm, type AuthFormField } from '@mindscript/ui';
import { getSupabaseBrowserClient } from '@mindscript/auth/client';

const resetFields: AuthFormField[] = [
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    placeholder: 'you@example.com',
    required: true,
    autoComplete: 'email',
  },
];

export default function ResetPasswordPage() {
  const [emailSent, setEmailSent] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const supabase = getSupabaseBrowserClient();

  const handleResetRequest = async (data: Record<string, string>) => {
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/reset-password/confirm`,
    });
    
    if (error) throw error;
    
    setUserEmail(data.email);
    setEmailSent(true);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
              <p className="mt-2 text-sm text-gray-600">
                We've sent a password reset link to
              </p>
              <p className="font-medium text-gray-900">{userEmail}</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              Click the link in your email to reset your password. The link will expire in 1 hour.
            </div>

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
            <p className="text-gray-600 mt-2">Reset your password</p>
          </div>

          <AuthForm
            title="Forgot your password?"
            subtitle="Enter your email and we'll send you a reset link"
            fields={resetFields}
            submitLabel="Send reset link"
            onSubmit={handleResetRequest}
            footer={
              <div className="mt-6 text-center text-sm text-gray-600">
                Remember your password?{' '}
                <Link 
                  href="/auth/login"
                  className="text-indigo-600 hover:text-indigo-500 font-medium"
                >
                  Sign in
                </Link>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}