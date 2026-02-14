'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@mindscript/ui';
import { SettingsForm } from './SettingsForm';
import { AccountManagement } from './AccountManagement';

export function SettingsTabs() {
  return (
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
  );
}
