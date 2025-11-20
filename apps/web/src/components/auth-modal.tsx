'use client';

import React, { useState, useEffect } from 'react';
import { Button, Input } from "@mindscript/ui";
import { cn } from '../lib/utils';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated?: (user: any) => Promise<void> | void;
  mode?: 'signup' | 'login';
  title?: string;
  description?: string;
}

export function AuthModal({
  isOpen,
  onClose,
  onAuthenticated,
  mode: initialMode = 'signup',
  title = "Create Your First Track",
  description = "Sign up to create your personalized audio track with special first-time pricing",
}: AuthModalProps) {
  const [mode, setMode] = useState<'signup' | 'login'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setMessage(null);
      // Don't clear email when switching modes to preserve it for login
      if (mode === initialMode) {
        setEmail('');
      }
      setPassword('');
      setFullName('');
    }
  }, [isOpen, mode, initialMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('AUTH MODAL: Form submitted', { mode, email, hasPassword: !!password });
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setMessage("Processing...");

    const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
    const payload: any = {
      email: email.trim().toLowerCase(),
      password,
    };

    // Add mode-specific fields
    if (mode === 'signup') {
      payload.fullName = fullName.trim();
    } else {
      payload.next = '/library'; // Only login uses next parameter
    }

    try {
      console.log('AUTH MODAL: Calling server endpoint:', endpoint);

      // Make the request - server will return JSON with redirect URL
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin' // Include cookies
      });

      console.log('AUTH MODAL: Response status:', response.status);

      // Parse the response
      const data = await response.json();
      console.log('AUTH MODAL: Response data:', data);

      // Handle successful authentication
      if (response.ok && data.success) {
        console.log('AUTH MODAL: Authentication successful');
        setMessage(onAuthenticated ? 'Success! Continuing...' : 'Success! Redirecting...');

        if (onAuthenticated) {
          await onAuthenticated(data.user);
          onClose();
        } else {
          onClose();
          if (data.redirectUrl) {
            console.log('AUTH MODAL: Redirecting to:', data.redirectUrl);
            window.location.href = data.redirectUrl;
          } else {
            window.location.href = '/library';
          }
        }
        return;
      }

      // Handle error responses
      if (data.error) {
        if (data.error.includes('already registered')) {
          setMode('login');
          setError('This email is already registered. Please sign in instead.');
          setPassword('');
        } else {
          setError(data.error);
        }
      } else {
        setError('Authentication failed. Please try again.');
      }

    } catch (error: any) {
      console.error('AUTH MODAL: Network error:', error);
      setError('Network error occurred. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
      setMessage(null);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    console.log('AUTH MODAL: Social login not yet implemented for:', provider);
    setError(`${provider} login is coming soon!`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold font-sora mb-2">{title}</h2>
            <p className="text-gray-600 text-sm">{description}</p>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={cn(
                'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
                mode === 'signup'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className={cn(
                'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
                mode === 'login'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Sign In
            </button>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="text-gray-700">Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleSocialLogin('github')}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="text-gray-700">Continue with GitHub</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          {/* Error/Message Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">
              {message}
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  required={mode === 'signup'}
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isLoading}
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Create a password' : 'Enter your password'}
                required
                minLength={6}
                disabled={isLoading}
                className="w-full"
              />
              {mode === 'signup' && (
                <p className="mt-1 text-xs text-gray-500">
                  Must be at least 6 characters long
                </p>
              )}
            </div>

            {mode === 'login' && (
              <div className="text-right">
                <a href="/auth/reset-password" className="text-sm text-indigo-600 hover:text-indigo-500">
                  Forgot your password?
                </a>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {mode === 'signup' ? 'Creating Account...' : 'Signing In...'}
                </span>
              ) : (
                mode === 'signup' ? 'Create Account' : 'Sign In'
              )}
            </Button>
          </form>

          {/* Terms */}
          {mode === 'signup' && (
            <p className="mt-4 text-xs text-center text-gray-500">
              By signing up, you agree to our{' '}
              <a href="/terms" className="text-indigo-600 hover:text-indigo-500">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-indigo-600 hover:text-indigo-500">
                Privacy Policy
              </a>
            </p>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
            disabled={isLoading}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
