import { describe, it, expect, beforeEach, vi } from 'vitest';
// @ts-ignore - Will be installed
import { renderHook, act } from '@testing-library/react-hooks';
import { useAuthStore } from '../authStore';
import { supabase } from '../../lib/supabase';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshSession: vi.fn(),
      updateUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getUser: vi.fn(),
    },
  },
}));

vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: vi.fn(),
    getItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe('AuthStore', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      session: null,
      user: null,
      isLoading: false,
      isInitialized: false,
      error: null,
    });
  });

  describe('initialize', () => {
    it('should initialize with stored session', async () => {
      const mockSession = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: '123',
          email: 'test@example.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString()
        } as any,
      } as any;

      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('test-refresh');
      vi.mocked(supabase.auth.refreshSession).mockResolvedValueOnce({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.session).toEqual(mockSession);
      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle initialization without stored session', async () => {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);
      vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle initialization error', async () => {
      const error = new Error('Failed to initialize');
      vi.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.error).toBe('Failed to initialize');
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('signIn', () => {
    it('should sign in successfully', async () => {
      const mockSession = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: '123',
          email: 'test@example.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString()
        } as any,
      } as any;

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.signIn('test@example.com', 'password123');
      });

      expect(result.current.session).toEqual(mockSession);
      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.error).toBeNull();
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'mindscript_auth_token',
        'test-token'
      );
    });

    it('should handle sign in error', async () => {
      const error = { message: 'Invalid credentials', code: 'invalid_credentials', status: 400, __isAuthError: true } as any;
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { session: null, user: null },
        error,
      });

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.signIn('test@example.com', 'wrongpassword');
        })
      ).rejects.toThrow('Invalid credentials');

      expect(result.current.error).toBe('Invalid credentials');
      expect(result.current.session).toBeNull();
    });
  });

  describe('signUp', () => {
    it('should sign up successfully', async () => {
      const mockSession = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: '123',
          email: 'test@example.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString()
        } as any,
      } as any;

      vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.signUp('test@example.com', 'password123');
      });

      expect(result.current.session).toEqual(mockSession);
      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.error).toBeNull();
    });

    it('should handle sign up with email confirmation', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
        data: {
          session: null,
          user: {
            id: '123',
            email: 'test@example.com',
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString()
          } as any
        },
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.signUp('test@example.com', 'password123');
      });

      expect(result.current.session).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      // Set initial state with a session
      useAuthStore.setState({
        session: { access_token: 'test', refresh_token: 'test' } as any,
        user: { id: '123', email: 'test@example.com' } as any,
      });

      vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'mindscript_auth_token'
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'mindscript_refresh_token'
      );
    });
  });

  describe('refreshSession', () => {
    it('should refresh session successfully', async () => {
      const mockSession = {
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: '123',
          email: 'test@example.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString()
        } as any,
      } as any;

      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('old-refresh');
      vi.mocked(supabase.auth.refreshSession).mockResolvedValueOnce({
        data: { session: mockSession, user: mockSession.user },
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(result.current.session).toEqual(mockSession);
      expect(result.current.user).toEqual(mockSession.user);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'mindscript_auth_token',
        'new-token'
      );
    });

    it('should handle refresh session error', async () => {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.refreshSession();
        })
      ).rejects.toThrow('No refresh token available');

      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const updatedUser = {
        id: '123',
        email: 'test@example.com',
        user_metadata: { name: 'Test User' },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as any;

      vi.mocked(supabase.auth.updateUser).mockResolvedValueOnce({
        data: { user: updatedUser },
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.updateProfile({ user_metadata: { name: 'Test User' } } as any);
      });

      expect(result.current.user).toEqual(updatedUser);
      expect(result.current.error).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('should send reset password email successfully', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValueOnce({
        data: {},
        error: null,
      });

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.resetPassword('test@example.com');
      });

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        { redirectTo: 'mindscript://reset-password' }
      );
      expect(result.current.error).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useAuthStore.setState({ error: 'Some error' });

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});