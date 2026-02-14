import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as SecureStore from 'expo-secure-store';

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
          const { refreshToken } = await getStoredTokens();

          if (refreshToken) {
            const { data, error } = await supabase.auth.refreshSession({
              refresh_token: refreshToken,
            });

            if (error) throw error;

            if (data.session) {
              await saveTokens(data.session);
              set({
                session: data.session,
                user: data.user,
                isInitialized: true,
                isLoading: false,
              });
              return;
            }
          }

          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          if (error) throw error;

          if (session) {
            await saveTokens(session);
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

          supabase.auth.onAuthStateChange(async (_event, session) => {
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
            await saveTokens(data.session);
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
          const { error } = await supabase.auth.signOut();
          if (error) throw error;

          await clearTokens();
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
          const { refreshToken } = await getStoredTokens();
          if (!refreshToken) throw new Error('No refresh token available');

          const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refreshToken,
          });

          if (error) throw error;

          if (data.session) {
            await saveTokens(data.session);
            set({
              session: data.session,
              user: data.user,
              isLoading: false,
            });
          }
        } catch (error) {
          console.error('Error refreshing session:', error);
          await clearTokens();
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
