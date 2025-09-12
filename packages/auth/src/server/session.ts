import { getSupabaseServerClient, getSupabaseServerComponentClient } from './supabase-server';
import type { AuthUserWithProfile } from '@mindscript/types';
import { ProfileRowSchema, UserPreferencesRowSchema, SellerAgreementRowSchema } from '@mindscript/schemas';
import type { User } from '@supabase/supabase-js';

export async function getServerSession(options?: { serviceRole?: boolean }) {
  const supabase = await getSupabaseServerClient(options);
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) {
    return null;
  }

  return session;
}

export async function getServerUser(options?: { serviceRole?: boolean }): Promise<User | null> {
  const supabase = await getSupabaseServerClient(options);
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }

  return user;
}

export async function getServerUserWithProfile(): Promise<AuthUserWithProfile | null> {
  const supabase = await getSupabaseServerComponentClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return null;
  }

  // Fetch profile data
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Fetch preferences
  const { data: preferencesData } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // Fetch seller agreement if exists
  const { data: sellerData } = await supabase
    .from('seller_agreements')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Parse and transform data
  const profile = profileData ? ProfileRowSchema.parse(profileData) : undefined;
  const preferences = preferencesData ? UserPreferencesRowSchema.parse(preferencesData) : undefined;
  const sellerAgreement = sellerData ? SellerAgreementRowSchema.parse(sellerData) : undefined;

  return {
    id: user.id,
    email: user.email!,
    emailVerified: user.email_confirmed_at !== null,
    appMetadata: user.app_metadata,
    userMetadata: user.user_metadata,
    role: user.role,
    createdAt: user.created_at,
    updatedAt: user.updated_at || user.created_at,
    profile: profile ? {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name || undefined,
      avatarUrl: profile.avatar_url || undefined,
      bio: profile.bio || undefined,
      stripeCustomerId: profile.stripe_customer_id || undefined,
      roleFlags: {
        isAdmin: profile.role_flags.is_admin,
        isSeller: profile.role_flags.is_seller,
      },
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    } : undefined,
    preferences: preferences ? {
      userId: preferences.user_id,
      theme: preferences.theme,
      notificationsEnabled: preferences.notifications_enabled,
      emailUpdates: preferences.email_updates,
      language: preferences.language,
      timezone: preferences.timezone,
      privacySettings: {
        profilePublic: preferences.privacy_settings.profile_public,
        showPurchases: preferences.privacy_settings.show_purchases,
      },
      createdAt: preferences.created_at,
      updatedAt: preferences.updated_at,
    } : undefined,
    sellerAgreement: sellerAgreement ? {
      id: sellerAgreement.id,
      userId: sellerAgreement.user_id,
      acceptedAt: sellerAgreement.accepted_at,
      agreementVersion: sellerAgreement.agreement_version,
      stripeConnectId: sellerAgreement.stripe_connect_id || undefined,
      onboardingStatus: sellerAgreement.onboarding_status,
      capabilities: {
        transfers: sellerAgreement.capabilities.transfers,
        payouts: sellerAgreement.capabilities.payouts,
      },
      metadata: sellerAgreement.metadata,
      createdAt: sellerAgreement.created_at,
      updatedAt: sellerAgreement.updated_at,
    } : undefined,
  };
}

export async function requireAuth() {
  const session = await getServerSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}

export async function requireAuthWithProfile() {
  const userWithProfile = await getServerUserWithProfile();
  
  if (!userWithProfile) {
    throw new Error('Unauthorized');
  }

  return userWithProfile;
}