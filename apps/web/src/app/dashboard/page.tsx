'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@mindscript/auth/hooks';
import { Button, Card } from '@mindscript/ui';

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <Button onClick={handleSignOut} variant="outline">
            Sign Out
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">Welcome Back!</h2>
            <p className="text-gray-600">
              {profile?.displayName || user?.email}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Account created: {new Date(user?.createdAt || '').toLocaleDateString()}
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">Your Scripts</h2>
            <p className="text-gray-600">No scripts created yet</p>
            <Button className="mt-4 w-full" size="sm">
              Create Your First Script
            </Button>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">Audio Library</h2>
            <p className="text-gray-600">No audio tracks generated</p>
            <Button className="mt-4 w-full" size="sm" variant="outline">
              Browse Templates
            </Button>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-2">Account Settings</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Verified:</span>
                <span className="font-medium">
                  {user?.emailVerified ? (
                    <span className="text-green-600">Yes</span>
                  ) : (
                    <span className="text-yellow-600">Pending</span>
                  )}
                </span>
              </div>
            </div>
            <Button className="mt-4 w-full" size="sm" variant="outline">
              Manage Account
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}