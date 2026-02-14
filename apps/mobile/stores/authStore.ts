import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User, Subscription } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

// Keep a reference to the auth state change subscription so we can clean up
let authSubscription: Subscription | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      initialize: async () => {
        if (get().isInitialized) return;

        set({ isLoading: true, error: null });
        try {
          // Let the SDK retrieve its own persisted session (via ExpoSecureStoreAdapter)
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          if (error) throw error;

          if (session) {
            set({
              session,
              user: session.user,
              isInitialized: true,
              isLoading: false,
            });
          } else {
            set({
              session: null,
              user: null,
              isInitialized: true,
              isLoading: false,
            });
          }

          // Listen for SDK-driven auth changes (auto-refresh, sign-out, etc.)
          // Clean up any previous subscription first
          if (authSubscription) {
            authSubscription.unsubscribe();
          }

          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
              if (session) {
                set({ session, user: session.user, error: null });
              } else {
                set({ session: null, user: null });
              }
            },
          );
          authSubscription = subscription;
        } catch (error) {
          console.error('Error initializing auth:', error);
          // Clean up any stale SDK session
          try {
            await supabase.auth.signOut();
          } catch {
            // ignore cleanup errors
          }
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to initialize auth',
            isLoading: false,
            isInitialized: true,
            session: null,
            user: null,
          });
        }
      },

      signIn: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) throw error;

          if (data.session) {
            // SDK persists tokens automatically via ExpoSecureStoreAdapter
            set({
              session: data.session,
              user: data.user,
              isLoading: false,
            });
          }
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to sign in',
            isLoading: false,
          });
          throw error;
        }
      },

      signOut: async () => {
        set({ isLoading: true, error: null });
        try {
          // Unsubscribe from auth changes before signing out
          if (authSubscription) {
            authSubscription.unsubscribe();
            authSubscription = null;
          }

          const { error } = await supabase.auth.signOut();
          if (error) throw error;

          // SDK clears its own token storage automatically
          set({
            session: null,
            user: null,
            isLoading: false,
          });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to sign out',
            isLoading: false,
          });
          throw error;
        }
      },

      refreshSession: async () => {
        set({ isLoading: true, error: null });
        try {
          // Let the SDK use its own stored refresh token
          const { data, error } = await supabase.auth.refreshSession();

          if (error) throw error;

          if (data.session) {
            set({
              session: data.session,
              user: data.user,
              isLoading: false,
            });
          }
        } catch (error) {
          console.error('Error refreshing session:', error);
          set({
            session: null,
            user: null,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to refresh session',
            isLoading: false,
          });
          throw error;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
      }),
    },
  ),
);
