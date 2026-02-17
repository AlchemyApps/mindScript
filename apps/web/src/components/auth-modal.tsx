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
        // Email verification required — redirect to verify page
        if (data.requiresVerification) {
          console.log('AUTH MODAL: Email verification required');
          setMessage(null);
          onClose();
          window.location.href = data.redirectUrl || '/auth/verify';
          return;
        }

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

          {/* Email auth form */}

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
