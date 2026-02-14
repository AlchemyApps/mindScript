'use client';

import React, { useState } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { PasswordStrength } from './PasswordStrength';
import { cn } from '../utils/cn';

export interface AuthFormField {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  defaultValue?: string;
  disabled?: boolean;
}

interface AuthFormProps {
  title: string;
  subtitle?: string;
  fields: AuthFormField[];
  submitLabel: string;
  onSubmit: (data: Record<string, string>) => Promise<void>;
  showPasswordStrength?: boolean;
  footer?: React.ReactNode;
  className?: string;
}

export function AuthForm({
  title,
  subtitle,
  fields,
  submitLabel,
  onSubmit,
  showPasswordStrength = false,
  footer,
  className,
}: AuthFormProps) {
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    fields.forEach(f => {
      if (f.defaultValue) initial[f.name] = f.defaultValue;
    });
    return initial;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (generalError) {
      setGeneralError(null);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    fields.forEach(field => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
      
      // Email validation
      if (field.type === 'email' && formData[field.name]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData[field.name])) {
          newErrors[field.name] = 'Please enter a valid email address';
        }
      }
      
      // Password validation (only for signup)
      if (field.name === 'password' && showPasswordStrength && formData[field.name]) {
        const password = formData[field.name];
        if (password.length < 8) {
          newErrors[field.name] = 'Password must be at least 8 characters';
        } else if (!/[A-Z]/.test(password)) {
          newErrors[field.name] = 'Password must contain at least one uppercase letter';
        } else if (!/[a-z]/.test(password)) {
          newErrors[field.name] = 'Password must contain at least one lowercase letter';
        } else if (!/[0-9]/.test(password)) {
          newErrors[field.name] = 'Password must contain at least one number';
        }
      }
      
      // Confirm password validation
      if (field.name === 'confirmPassword' && formData.confirmPassword !== formData.password) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setGeneralError(null);
    
    try {
      await onSubmit(formData);
    } catch (error) {
      if (error instanceof Error) {
        setGeneralError(error.message);
      } else {
        setGeneralError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordField = fields.find(f => f.name === 'password');
  const showStrength = showPasswordStrength && passwordField && formData.password;

  return (
    <div className={cn('w-full max-w-md mx-auto', className)}>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {generalError && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {generalError}
          </div>
        )}

        <div className="space-y-4">
          {fields.map(field => (
            <div key={field.name}>
              <label 
                htmlFor={field.name}
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <Input
                id={field.name}
                name={field.name}
                type={field.type}
                placeholder={field.placeholder}
                autoComplete={field.autoComplete}
                value={formData[field.name] || ''}
                onChange={handleChange}
                error={errors[field.name]}
                disabled={field.disabled || loading}
                required={field.required}
              />
              {field.name === 'password' && showStrength && (
                <div className="mt-2">
                  <PasswordStrength password={formData.password || ''} />
                </div>
              )}
            </div>
          ))}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={loading}
        >
          {loading ? 'Loading...' : submitLabel}
        </Button>

        {footer && (
          <div className="mt-6">
            {footer}
          </div>
        )}
      </form>
    </div>
  );
}