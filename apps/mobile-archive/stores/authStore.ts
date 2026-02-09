import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  // State
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
}

// Secure token storage
const TOKEN_KEY = 'mindscript_auth_token';
const REFRESH_TOKEN_KEY = 'mindscript_refresh_token';

async function saveTokens(session: Session) {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, session.access_token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refresh_token);
  } catch (error) {
    console.error('Error saving tokens to secure store:', error);
  }
}

async function clearTokens() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Error clearing tokens from secure store:', error);
  }
}

async function getStoredTokens() {
  try {
    const accessToken = await SecureStore.getItemAsync(TOKEN_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Error retrieving tokens from secure store:', error);
    return { accessToken: null, refreshToken: null };
  }
}

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
          // Get stored tokens
          const { refreshToken } = await getStoredTokens();

          if (refreshToken) {
            // Try to restore session with refresh token
            const { data, error } = await supabase.auth.refreshSession({
              refresh_token: refreshToken
            });

            if (error) throw error;

            if (data.session) {
              await saveTokens(data.session);
              set({
                session: data.session,
                user: data.user,
                isInitialized: true,
                isLoading: false
              });
              return;
            }
          }

          // No stored session, get current session from Supabase
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) throw error;

          if (session) {
            await saveTokens(session);
            set({
              session,
              user: session.user,
              isInitialized: true,
              isLoading: false
            });
          } else {
            set({
              session: null,
              user: null,
              isInitialized: true,
              isLoading: false
            });
          }

          // Set up auth state listener
          supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
              await saveTokens(session);
              set({ session, user: session.user });
            } else {
              await clearTokens();
              set({ session: null, user: null });
            }
          });

        } catch (error) {
          console.error('Error initializing auth:', error);
          await clearTokens();
          set({
            error: error instanceof Error ? error.message : 'Failed to initialize auth',
            isLoading: false,
            isInitialized: true,
            session: null,
            user: null
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
            await saveTokens(data.session);
            set({
              session: data.session,
              user: data.user,
              isLoading: false
            });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to sign in',
            isLoading: false
          });
          throw error;
        }
      },

      signUp: async (email: string, password: string, metadata?: Record<string, any>) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: metadata,
            },
          });

          if (error) throw error;

          if (data.session) {
            await saveTokens(data.session);
            set({
              session: data.session,
              user: data.user,
              isLoading: false
            });
          } else {
            // Email confirmation required
            set({ isLoading: false });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to sign up',
            isLoading: false
          });
          throw error;
        }
      },

      signOut: async () => {
        set({ isLoading: true, error: null });
        try {
          const { error } = await supabase.auth.signOut();
          if (error) throw error;

          await clearTokens();
          set({
            session: null,
            user: null,
            isLoading: false
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to sign out',
            isLoading: false
          });
          throw error;
        }
      },

      refreshSession: async () => {
        set({ isLoading: true, error: null });
        try {
          const { refreshToken } = await getStoredTokens();

          if (!refreshToken) {
            throw new Error('No refresh token available');
          }

          const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refreshToken
          });

          if (error) throw error;

          if (data.session) {
            await saveTokens(data.session);
            set({
              session: data.session,
              user: data.user,
              isLoading: false
            });
          }
        } catch (error) {
          console.error('Error refreshing session:', error);
          // If refresh fails, clear auth state
          await clearTokens();
          set({
            session: null,
            user: null,
            error: error instanceof Error ? error.message : 'Failed to refresh session',
            isLoading: false
          });
          throw error;
        }
      },

      updateProfile: async (updates: Partial<User>) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase.auth.updateUser({
            data: updates as any,
          });

          if (error) throw error;

          set({
            user: data.user,
            isLoading: false
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update profile',
            isLoading: false
          });
          throw error;
        }
      },

      resetPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'mindscript://reset-password',
          });

          if (error) throw error;

          set({ isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to send reset email',
            isLoading: false
          });
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist non-sensitive data
        user: state.user,
        isInitialized: state.isInitialized,
      }),
    }
  )
);