'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Profile, calculateProfileCompletion } from '@mindscript/schemas';
import { Button } from '@mindscript/ui';
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Edit2,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface ProfileViewProps {
  profile: Profile;
  isOwnProfile?: boolean;
}

export function ProfileView({ profile, isOwnProfile = false }: ProfileViewProps) {
  const [imageError, setImageError] = useState(false);
  const completionPercentage = calculateProfileCompletion(profile);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {/* Header with avatar and basic info */}
        <div className="relative h-32 bg-gradient-to-r from-purple-500 to-indigo-600">
          {isOwnProfile && (
            <Link
              href="/profile/edit"
              className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
            >
              <Edit2 className="h-5 w-5 text-white" />
            </Link>
          )}
        </div>
        
        <div className="px-6 pb-6">
          <div className="relative -mt-16 mb-4">
            <div className="h-32 w-32 rounded-full border-4 border-white dark:border-gray-800 overflow-hidden bg-gray-200 dark:bg-gray-700">
              {profile.avatar_url && !imageError ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.display_name || 'Profile'}
                  width={128}
                  height={128}
                  className="object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <User className="h-16 w-16 text-gray-400" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Name and username */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {profile.display_name || 'Unnamed User'}
              </h1>
              {profile.username && (
                <p className="text-gray-500 dark:text-gray-400">
                  @{profile.username}
                </p>
              )}
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}

            {/* Profile completion (own profile only) */}
            {isOwnProfile && completionPercentage < 100 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Profile Completion
                  </span>
                  <span className="text-sm font-bold text-yellow-800 dark:text-yellow-200">
                    {completionPercentage}%
                  </span>
                </div>
                <div className="w-full bg-yellow-200 dark:bg-yellow-800 rounded-full h-2">
                  <div
                    className="bg-yellow-600 dark:bg-yellow-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
                {completionPercentage < 100 && (
                  <Link
                    href="/profile/edit"
                    className="text-sm text-yellow-700 dark:text-yellow-300 hover:underline mt-2 inline-block"
                  >
                    Complete your profile →
                  </Link>
                )}
              </div>
            )}

            {/* Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {/* Email (own profile only) */}
              {isOwnProfile && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Email</span>
                    <p className="text-gray-900 dark:text-white">{profile.email}</p>
                  </div>
                </div>
              )}

              {/* Email verified status */}
              {isOwnProfile && (
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Email Status</span>
                    <div className="flex items-center gap-1">
                      {profile.email_verified ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-green-600 dark:text-green-400">Verified</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-yellow-500" />
                          <span className="text-yellow-600 dark:text-yellow-400">Unverified</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Member since */}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Member Since</span>
                  <p className="text-gray-900 dark:text-white">
                    {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {/* Account status */}
              {isOwnProfile && (
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Account Status</span>
                    <p className="text-gray-900 dark:text-white capitalize">
                      {profile.account_status}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            {isOwnProfile && (
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button asChild>
                  <Link href="/profile/edit">Edit Profile</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/profile/settings">Settings</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}