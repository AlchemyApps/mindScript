'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthForm, type AuthFormField } from '@mindscript/ui';
import { getSupabaseBrowserClient } from '@mindscript/auth/client';

const newPasswordFields: AuthFormField[] = [
  {
    name: 'password',
    label: 'New Password',
    type: 'password',
    placeholder: '••••••••',
    required: true,
    autoComplete: 'new-password',
  },
  {
    name: 'confirmPassword',
    label: 'Confirm New Password',
    type: 'password',
    placeholder: '••••••••',
    required: true,
    autoComplete: 'new-password',
  },
];

export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    // Check if we have a valid session from the reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // No valid reset session, redirect to reset request page
        router.push('/auth/reset-password');
      }
    };
    checkSession();
  }, [supabase, router]);

  const handlePasswordUpdate = async (data: Record<string, string>) => {
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });
      
      if (error) throw error;
      
      // Sign out to force re-login with new password
      await supabase.auth.signOut();
      
      // Redirect to login with success message
      router.push('/auth/login?reset=success');
    } catch (error) {
      throw error;
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
            <p className="text-gray-600 mt-2">Set your new password</p>
          </div>

          <AuthForm
            title="Create new password"
            subtitle="Your new password must be different from previous passwords"
            fields={newPasswordFields}
            submitLabel={loading ? 'Updating...' : 'Update password'}
            onSubmit={handlePasswordUpdate}
            showPasswordStrength={true}
          />
        </div>
      </div>
    </div>
  );
}