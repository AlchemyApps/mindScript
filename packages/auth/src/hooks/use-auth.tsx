'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '../client/supabase-browser';
import type { User, Session } from '@supabase/supabase-js';
import type { AuthUserWithProfile } from '@mindscript/types';
import { SignUpSchema, SignInSchema, ProfileUpdateSchema } from '@mindscript/schemas';
import type { z } from 'zod';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AuthUserWithProfile | null;
  loading: boolean;
  signUp: (data: z.infer<typeof SignUpSchema>) => Promise<void>;
  signIn: (data: z.infer<typeof SignInSchema>) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: z.infer<typeof ProfileUpdateSchema>) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthUserWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const fetchProfile = useCallback(async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*, user_preferences(*), seller_agreements(*)')
      .eq('id', userId)
      .single();

    if (profileData) {
      const userWithProfile: AuthUserWithProfile = {
        id: userId,
        email: profileData.email,
        emailVerified: user?.email_confirmed_at !== undefined,
        role: user?.role,
        createdAt: user?.created_at || '',
        updatedAt: user?.updated_at || user?.created_at || '',
        profile: {
          id: profileData.id,
          email: profileData.email,
          displayName: profileData.display_name,
          avatarUrl: profileData.avatar_url,
          bio: profileData.bio,
          stripeCustomerId: profileData.stripe_customer_id,
          roleFlags: {
            isAdmin: profileData.role_flags?.is_admin || false,
            isSeller: profileData.role_flags?.is_seller || false,
          },
          createdAt: profileData.created_at,
          updatedAt: profileData.updated_at,
        },
        preferences: profileData.user_preferences?.[0] ? {
          userId: profileData.user_preferences[0].user_id,
          theme: profileData.user_preferences[0].theme,
          notificationsEnabled: profileData.user_preferences[0].notifications_enabled,
          emailUpdates: profileData.user_preferences[0].email_updates,
          language: profileData.user_preferences[0].language,
          timezone: profileData.user_preferences[0].timezone,
          privacySettings: {
            profilePublic: profileData.user_preferences[0].privacy_settings?.profile_public || true,
            showPurchases: profileData.user_preferences[0].privacy_settings?.show_purchases || false,
          },
          createdAt: profileData.user_preferences[0].created_at,
          updatedAt: profileData.user_preferences[0].updated_at,
        } : undefined,
        sellerAgreement: profileData.seller_agreements?.[0] ? {
          id: profileData.seller_agreements[0].id,
          userId: profileData.seller_agreements[0].user_id,
          acceptedAt: profileData.seller_agreements[0].accepted_at,
          agreementVersion: profileData.seller_agreements[0].agreement_version,
          stripeConnectId: profileData.seller_agreements[0].stripe_connect_id,
          onboardingStatus: profileData.seller_agreements[0].onboarding_status,
          capabilities: {
            transfers: profileData.seller_agreements[0].capabilities?.transfers || false,
            payouts: profileData.seller_agreements[0].capabilities?.payouts || false,
          },
          metadata: profileData.seller_agreements[0].metadata || {},
          createdAt: profileData.seller_agreements[0].created_at,
          updatedAt: profileData.seller_agreements[0].updated_at,
        } : undefined,
      };
      setProfile(userWithProfile);
    }
  }, [supabase, user]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }

      if (event === 'SIGNED_OUT') {
        router.push('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router, fetchProfile]);

  const signUp = async (data: z.infer<typeof SignUpSchema>) => {
    const validated = SignUpSchema.parse(data);
    const { error } = await supabase.auth.signUp({
      email: validated.email,
      password: validated.password,
      options: {
        data: {
          display_name: validated.displayName,
        },
      },
    });

    if (error) throw error;
  };

  const signIn = async (data: z.infer<typeof SignInSchema>) => {
    const validated = SignInSchema.parse(data);
    const { error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateProfile = async (data: z.infer<typeof ProfileUpdateSchema>) => {
    if (!user) throw new Error('No user logged in');
    
    const validated = ProfileUpdateSchema.parse(data);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: validated.displayName,
        bio: validated.bio,
        avatar_url: validated.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) throw error;
    await fetchProfile(user.id);
  };

  const refreshSession = async () => {
    const { error } = await supabase.auth.refreshSession();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}