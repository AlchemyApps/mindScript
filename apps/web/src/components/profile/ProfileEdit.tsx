'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileUpdateSchema, type ProfileUpdate } from '@mindscript/schemas';
import { Button, Input, Textarea, Label } from '@mindscript/ui';
import { AvatarUpload } from './AvatarUpload';
import { useAuth } from '@mindscript/auth/hooks';
import { toast } from 'sonner';
import { Loader2, Check, X } from 'lucide-react';

export function ProfileEdit() {
  const router = useRouter();
  const { profile, updateProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameDebounce, setUsernameDebounce] = useState<NodeJS.Timeout>();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
    setError
  } = useForm<ProfileUpdate>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      username: profile?.profile?.username || '',
      display_name: profile?.profile?.displayName || '',
      bio: profile?.profile?.bio || '',
      avatar_url: profile?.profile?.avatarUrl || ''
    }
  });

  const watchedUsername = watch('username');

  // Check username availability
  useEffect(() => {
    if (usernameDebounce) {
      clearTimeout(usernameDebounce);
    }

    if (!watchedUsername || watchedUsername === profile?.profile?.username) {
      setUsernameAvailable(null);
      return;
    }

    if (watchedUsername.length < 3) {
      setUsernameAvailable(false);
      return;
    }

    setCheckingUsername(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch('/api/profile/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: watchedUsername })
        });

        const data = await response.json();
        setUsernameAvailable(data.available);
        
        if (!data.available && data.error) {
          setError('username', { message: data.error });
        }
      } catch (error) {
        console.error('Username check error:', error);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    setUsernameDebounce(timeout);

    return () => clearTimeout(timeout);
  }, [watchedUsername, profile?.profile?.username, setError]);

  const onSubmit = async (data: ProfileUpdate) => {
    if (usernameAvailable === false && data.username !== profile?.profile?.username) {
      setError('username', { message: 'Username is not available' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      await updateProfile(data);
      toast.success('Profile updated successfully');
      router.push('/profile');
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = (url: string) => {
    setValue('avatar_url', url, { shouldDirty: true });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Edit Profile
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Avatar */}
          <div>
            <Label>Profile Picture</Label>
            <AvatarUpload
              currentAvatarUrl={profile?.profile?.avatarUrl}
              onAvatarChange={handleAvatarChange}
            />
          </div>

          {/* Username */}
          <div>
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <Input
                id="username"
                {...register('username')}
                placeholder="johndoe"
                className={errors.username ? 'border-red-500' : ''}
              />
              {checkingUsername && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              )}
              {!checkingUsername && usernameAvailable === true && watchedUsername && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
              )}
              {!checkingUsername && usernameAvailable === false && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-red-500" />
                </div>
              )}
            </div>
            {errors.username && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.username.message}
              </p>
            )}
            {usernameAvailable === true && watchedUsername && (
              <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                Username is available
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Your unique username for your public profile URL
            </p>
          </div>

          {/* Display Name */}
          <div>
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              {...register('display_name')}
              placeholder="John Doe"
              className={errors.display_name ? 'border-red-500' : ''}
            />
            {errors.display_name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.display_name.message}
              </p>
            )}
          </div>

          {/* Bio */}
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              {...register('bio')}
              placeholder="Tell us about yourself..."
              rows={4}
              className={errors.bio ? 'border-red-500' : ''}
            />
            {errors.bio && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.bio.message}
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Brief description for your profile (max 500 characters)
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="submit"
              disabled={isLoading || !isDirty || (checkingUsername || usernameAvailable === false)}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
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
      </div>
    </div>
  );
}