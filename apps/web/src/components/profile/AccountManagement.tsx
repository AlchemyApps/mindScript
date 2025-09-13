'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  emailChangeRequestSchema, 
  passwordChangeRequestSchema,
  accountDeletionRequestSchema,
  type EmailChangeRequest,
  type PasswordChangeRequest,
  type AccountDeletionRequest
} from '@mindscript/schemas';
import { Button, Input, Label, Textarea, Checkbox } from '@mindscript/ui';
import { useAuth } from '@mindscript/auth/hooks';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, Mail, Lock, Trash2 } from 'lucide-react';

export function AccountManagement() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<'email' | 'password' | 'delete' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Email change form
  const emailForm = useForm<EmailChangeRequest>({
    resolver: zodResolver(emailChangeRequestSchema)
  });

  // Password change form
  const passwordForm = useForm<PasswordChangeRequest>({
    resolver: zodResolver(passwordChangeRequestSchema)
  });

  // Account deletion form
  const deleteForm = useForm<AccountDeletionRequest>({
    resolver: zodResolver(accountDeletionRequestSchema)
  });

  const handleEmailChange = async (data: EmailChangeRequest) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/profile/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to change email');
      }

      const result = await response.json();
      toast.success(result.message);
      emailForm.reset();
      setActiveSection(null);
    } catch (error) {
      console.error('Email change error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to change email');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (data: PasswordChangeRequest) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to change password');
      }

      toast.success('Password changed successfully');
      passwordForm.reset();
      setActiveSection(null);
    } catch (error) {
      console.error('Password change error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountDeletion = async (data: AccountDeletionRequest) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/profile/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete account');
      }

      toast.success('Account deleted successfully');
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Account deletion error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Change */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Change Email Address
            </h2>
          </div>
          {activeSection !== 'email' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSection('email')}
            >
              Change
            </Button>
          )}
        </div>

        {activeSection === 'email' && (
          <form onSubmit={emailForm.handleSubmit(handleEmailChange)} className="space-y-4">
            <div>
              <Label htmlFor="new_email">New Email Address</Label>
              <Input
                id="new_email"
                type="email"
                {...emailForm.register('new_email')}
                placeholder="newemail@example.com"
                className={emailForm.formState.errors.new_email ? 'border-red-500' : ''}
              />
              {emailForm.formState.errors.new_email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {emailForm.formState.errors.new_email.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="email_password">Current Password</Label>
              <Input
                id="email_password"
                type="password"
                {...emailForm.register('password')}
                placeholder="Enter your current password"
                className={emailForm.formState.errors.password ? 'border-red-500' : ''}
              />
              {emailForm.formState.errors.password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {emailForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Change Email
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setActiveSection(null);
                  emailForm.reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Password Change */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Change Password
            </h2>
          </div>
          {activeSection !== 'password' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSection('password')}
            >
              Change
            </Button>
          )}
        </div>

        {activeSection === 'password' && (
          <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
            <div>
              <Label htmlFor="current_password">Current Password</Label>
              <Input
                id="current_password"
                type="password"
                {...passwordForm.register('current_password')}
                placeholder="Enter your current password"
                className={passwordForm.formState.errors.current_password ? 'border-red-500' : ''}
              />
              {passwordForm.formState.errors.current_password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {passwordForm.formState.errors.current_password.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                {...passwordForm.register('new_password')}
                placeholder="Enter your new password"
                className={passwordForm.formState.errors.new_password ? 'border-red-500' : ''}
              />
              {passwordForm.formState.errors.new_password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {passwordForm.formState.errors.new_password.message}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                At least 8 characters with uppercase, lowercase, and numbers
              </p>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Change Password
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setActiveSection(null);
                  passwordForm.reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Account Deletion */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-200">
              Delete Account
            </h2>
          </div>
          {activeSection !== 'delete' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setActiveSection('delete')}
            >
              Delete Account
            </Button>
          )}
        </div>

        {activeSection === 'delete' && (
          <form onSubmit={deleteForm.handleSubmit(handleAccountDeletion)} className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded p-4 border border-red-300 dark:border-red-700">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <p className="font-semibold mb-2">This action cannot be undone</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>All your data will be permanently deleted</li>
                    <li>Your username will become available to others</li>
                    <li>Any active subscriptions will be cancelled</li>
                    <li>Your created tracks and renders will be removed</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="delete_password">Confirm Password</Label>
              <Input
                id="delete_password"
                type="password"
                {...deleteForm.register('password')}
                placeholder="Enter your password to confirm"
                className={deleteForm.formState.errors.password ? 'border-red-500' : ''}
              />
              {deleteForm.formState.errors.password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {deleteForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="reason">Reason for leaving (optional)</Label>
              <Textarea
                id="reason"
                {...deleteForm.register('reason')}
                placeholder="Help us improve by telling us why you're leaving..."
                rows={3}
                className={deleteForm.formState.errors.reason ? 'border-red-500' : ''}
              />
              {deleteForm.formState.errors.reason && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {deleteForm.formState.errors.reason.message}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="confirm_delete"
                {...deleteForm.register('confirm')}
                className={deleteForm.formState.errors.confirm ? 'border-red-500' : ''}
              />
              <Label htmlFor="confirm_delete" className="text-sm">
                I understand that this action is permanent and cannot be undone
              </Label>
            </div>
            {deleteForm.formState.errors.confirm && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {deleteForm.formState.errors.confirm.message}
              </p>
            )}

            <div className="flex gap-3">
              <Button 
                type="submit" 
                variant="destructive"
                disabled={isLoading || !deleteForm.watch('confirm')}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Permanently Delete Account
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setActiveSection(null);
                  deleteForm.reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}