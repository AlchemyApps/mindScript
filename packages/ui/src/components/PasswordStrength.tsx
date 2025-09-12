import React from 'react';
import { cn } from '../utils/cn';

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

interface StrengthCheck {
  label: string;
  regex: RegExp;
  met: boolean;
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const checks: StrengthCheck[] = [
    {
      label: '8+ characters',
      regex: /.{8,}/,
      met: password.length >= 8,
    },
    {
      label: 'Uppercase letter',
      regex: /[A-Z]/,
      met: /[A-Z]/.test(password),
    },
    {
      label: 'Lowercase letter',
      regex: /[a-z]/,
      met: /[a-z]/.test(password),
    },
    {
      label: 'Number',
      regex: /[0-9]/,
      met: /[0-9]/.test(password),
    },
  ];

  const strength = checks.filter(c => c.met).length;
  const strengthPercent = (strength / checks.length) * 100;
  
  const strengthLabel = 
    strength === 0 ? 'Very Weak' :
    strength === 1 ? 'Weak' :
    strength === 2 ? 'Fair' :
    strength === 3 ? 'Good' :
    'Strong';

  const strengthColor = 
    strength === 0 ? 'bg-gray-300' :
    strength === 1 ? 'bg-red-500' :
    strength === 2 ? 'bg-orange-500' :
    strength === 3 ? 'bg-yellow-500' :
    'bg-green-500';

  if (!password) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Password strength</span>
        <span className={cn(
          'font-medium',
          strength === 0 ? 'text-gray-500' :
          strength === 1 ? 'text-red-600' :
          strength === 2 ? 'text-orange-600' :
          strength === 3 ? 'text-yellow-600' :
          'text-green-600'
        )}>
          {strengthLabel}
        </span>
      </div>
      
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={cn('h-full transition-all duration-300', strengthColor)}
          style={{ width: `${strengthPercent}%` }}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-1 text-xs">
        {checks.map((check, index) => (
          <div 
            key={index}
            className={cn(
              'flex items-center gap-1',
              check.met ? 'text-green-600' : 'text-gray-400'
            )}
          >
            <svg 
              className="w-3 h-3" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              {check.met ? (
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M5 13l4 4L19 7" 
                />
              ) : (
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              )}
            </svg>
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}