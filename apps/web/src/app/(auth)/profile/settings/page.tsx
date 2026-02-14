import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@mindscript/auth/server';
import { SettingsTabs } from '@/components/profile/SettingsTabs';

export const metadata: Metadata = {
  title: 'Settings | MindScript',
  description: 'Manage your account settings and preferences'
};

export default async function SettingsPage() {
  const supabase = await createServerClient();

  // Check authentication
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/auth/login');
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Settings
      </h1>

      <SettingsTabs />
    </div>
  );
}
