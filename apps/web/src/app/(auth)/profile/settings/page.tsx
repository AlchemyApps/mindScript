import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@mindscript/auth/server';
import { SettingsForm, AccountManagement } from '@/components/profile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@mindscript/ui';

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

      <Tabs defaultValue="preferences" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="preferences" className="space-y-6">
          <SettingsForm />
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <AccountManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}