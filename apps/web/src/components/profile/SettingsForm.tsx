'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { settingsUpdateSchema, type SettingsUpdate } from '@mindscript/schemas';
import { Button, Label, Switch, RadioGroup, RadioGroupItem } from '@mindscript/ui';
import { useAuth } from '@mindscript/auth/hooks';
import { toast } from 'sonner';
import { Loader2, Moon, Sun, Monitor } from 'lucide-react';

export function SettingsForm() {
  const router = useRouter();
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty }
  } = useForm<SettingsUpdate>({
    resolver: zodResolver(settingsUpdateSchema),
    defaultValues: {
      theme: profile?.preferences?.theme || 'system',
      notification_settings: {
        marketing_emails: profile?.preferences?.notificationSettings?.marketing_emails || false,
        product_updates: profile?.preferences?.notificationSettings?.product_updates || true,
        security_alerts: profile?.preferences?.notificationSettings?.security_alerts || true,
        newsletter: profile?.preferences?.notificationSettings?.newsletter || false,
        render_complete: profile?.preferences?.notificationSettings?.render_complete || true,
        payment_receipts: profile?.preferences?.notificationSettings?.payment_receipts || true
      },
      privacy_settings: {
        profile_visible: profile?.preferences?.privacySettings?.profilePublic !== false,
        show_email: profile?.preferences?.privacySettings?.show_email || false,
        show_tracks: profile?.preferences?.privacySettings?.show_tracks !== false,
        allow_messages: profile?.preferences?.privacySettings?.allow_messages || false,
        searchable: profile?.preferences?.privacySettings?.searchable !== false
      }
    }
  });

  const theme = watch('theme');

  const onSubmit = async (data: SettingsUpdate) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/profile/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }

      toast.success('Settings updated successfully');
      
      // Apply theme change immediately
      if (data.theme) {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        
        if (data.theme === 'system') {
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          root.classList.add(systemTheme);
        } else {
          root.classList.add(data.theme);
        }
      }
    } catch (error) {
      console.error('Settings update error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Theme Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Appearance
        </h2>
        
        <div className="space-y-4">
          <Label>Theme</Label>
          <RadioGroup
            value={theme}
            onValueChange={(value) => setValue('theme', value as any, { shouldDirty: true })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="light" id="light" />
              <Label htmlFor="light" className="flex items-center gap-2 cursor-pointer">
                <Sun className="h-4 w-4" />
                Light
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dark" id="dark" />
              <Label htmlFor="dark" className="flex items-center gap-2 cursor-pointer">
                <Moon className="h-4 w-4" />
                Dark
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="system" id="system" />
              <Label htmlFor="system" className="flex items-center gap-2 cursor-pointer">
                <Monitor className="h-4 w-4" />
                System
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Email Notifications
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="product_updates">Product Updates</Label>
              <p className="text-sm text-gray-500">New features and improvements</p>
            </div>
            <Switch
              id="product_updates"
              {...register('notification_settings.product_updates')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="security_alerts">Security Alerts</Label>
              <p className="text-sm text-gray-500">Important security notifications</p>
            </div>
            <Switch
              id="security_alerts"
              {...register('notification_settings.security_alerts')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="render_complete">Render Completions</Label>
              <p className="text-sm text-gray-500">When your audio renders are ready</p>
            </div>
            <Switch
              id="render_complete"
              {...register('notification_settings.render_complete')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="payment_receipts">Payment Receipts</Label>
              <p className="text-sm text-gray-500">Receipts and payment confirmations</p>
            </div>
            <Switch
              id="payment_receipts"
              {...register('notification_settings.payment_receipts')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="marketing_emails">Marketing Emails</Label>
              <p className="text-sm text-gray-500">Promotional content and offers</p>
            </div>
            <Switch
              id="marketing_emails"
              {...register('notification_settings.marketing_emails')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="newsletter">Newsletter</Label>
              <p className="text-sm text-gray-500">Weekly newsletter and updates</p>
            </div>
            <Switch
              id="newsletter"
              {...register('notification_settings.newsletter')}
            />
          </div>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Privacy
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="profile_visible">Public Profile</Label>
              <p className="text-sm text-gray-500">Allow others to view your profile</p>
            </div>
            <Switch
              id="profile_visible"
              {...register('privacy_settings.profile_visible')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="show_email">Show Email</Label>
              <p className="text-sm text-gray-500">Display email on public profile</p>
            </div>
            <Switch
              id="show_email"
              {...register('privacy_settings.show_email')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="show_tracks">Show Tracks</Label>
              <p className="text-sm text-gray-500">Display your created tracks publicly</p>
            </div>
            <Switch
              id="show_tracks"
              {...register('privacy_settings.show_tracks')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="allow_messages">Allow Messages</Label>
              <p className="text-sm text-gray-500">Let other users send you messages</p>
            </div>
            <Switch
              id="allow_messages"
              {...register('privacy_settings.allow_messages')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="searchable">Searchable</Label>
              <p className="text-sm text-gray-500">Appear in user search results</p>
            </div>
            <Switch
              id="searchable"
              {...register('privacy_settings.searchable')}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isLoading || !isDirty}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Settings
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/profile')}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}