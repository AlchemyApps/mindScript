import React, { useState } from 'react';
import { cn } from '../utils/cn';
import { Button } from './Button';

interface EmailVerificationBannerProps {
  email: string;
  onResend?: () => Promise<void>;
  className?: string;
}

export function EmailVerificationBanner({ 
  email, 
  onResend,
  className 
}: EmailVerificationBannerProps) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!onResend || resending) return;
    
    setResending(true);
    try {
      await onResend();
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (error) {
      console.error('Failed to resend verification email:', error);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className={cn(
      'bg-yellow-50 border border-yellow-200 rounded-lg p-4',
      className
    )}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg 
            className="h-5 w-5 text-yellow-400" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path 
              fillRule="evenodd" 
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
              clipRule="evenodd" 
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Email verification required
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              We've sent a verification email to <strong>{email}</strong>. 
              Please check your inbox and click the verification link to activate your account.
            </p>
          </div>
          {onResend && (
            <div className="mt-4">
              {resent ? (
                <p className="text-sm text-green-600">
                  Verification email sent! Check your inbox.
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResend}
                  disabled={resending}
                >
                  {resending ? 'Sending...' : 'Resend verification email'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}