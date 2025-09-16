import { createClient } from '@/lib/supabase/server'

/**
 * Check if a user is a super admin
 * Checks both profiles table role and user metadata as fallback
 */
export function isSuperAdmin(user: any, profileRole?: string): boolean {
  // First check profile role if provided
  if (profileRole) {
    return profileRole === 'super_admin'
  }

  // Fallback to app metadata
  const appRole = user?.app_metadata?.role
  if (appRole) {
    return appRole === 'super_admin'
  }

  // Fallback to user metadata (not recommended for security roles)
  const userRole = user?.user_metadata?.role
  if (userRole) {
    return userRole === 'super_admin'
  }

  return false
}

/**
 * Check if a user is an admin (either admin or super_admin)
 */
export function isAdmin(user: any, profileRole?: string): boolean {
  // First check profile role if provided
  if (profileRole) {
    return profileRole === 'admin' || profileRole === 'super_admin'
  }

  // Fallback to app metadata
  const appRole = user?.app_metadata?.role
  if (appRole) {
    return appRole === 'admin' || appRole === 'super_admin'
  }

  // Fallback to user metadata
  const userRole = user?.user_metadata?.role
  if (userRole) {
    return userRole === 'admin' || userRole === 'super_admin'
  }

  return false
}

/**
 * Get the user's role from all possible sources
 * Returns the first non-null role found
 */
export function getUserRole(user: any, profileRole?: string): string | null {
  // Priority order: profile > app_metadata > user_metadata
  return profileRole ||
         user?.app_metadata?.role ||
         user?.user_metadata?.role ||
         null
}

/**
 * Check user role and profile from database
 * Use this in server components for accurate role checking
 */
export async function checkUserRole(userId: string) {
  const supabase = await createClient()

  // Get profile with role
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, role, account_status')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    console.error('Error fetching profile:', error)
    return {
      hasProfile: false,
      role: null,
      isActive: false,
      isAdmin: false,
      isSuperAdmin: false,
    }
  }

  return {
    hasProfile: true,
    role: profile.role,
    isActive: profile.account_status === 'active',
    isAdmin: profile.role === 'admin' || profile.role === 'super_admin',
    isSuperAdmin: profile.role === 'super_admin',
  }
}

/**
 * Require admin access for a page
 * Throws an error if user is not admin
 */
export async function requireAdmin(userId: string) {
  const roleCheck = await checkUserRole(userId)

  if (!roleCheck.hasProfile || !roleCheck.isActive || !roleCheck.isAdmin) {
    throw new Error('Unauthorized: Admin access required')
  }

  return roleCheck
}

/**
 * Require super admin access for a page
 * Throws an error if user is not super admin
 */
export async function requireSuperAdmin(userId: string) {
  const roleCheck = await checkUserRole(userId)

  if (!roleCheck.hasProfile || !roleCheck.isActive || !roleCheck.isSuperAdmin) {
    throw new Error('Unauthorized: Super admin access required')
  }

  return roleCheck
}