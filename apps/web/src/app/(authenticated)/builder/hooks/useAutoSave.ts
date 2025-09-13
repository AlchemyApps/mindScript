import { useState, useEffect, useCallback, useRef } from 'react';

interface UseAutoSaveOptions {
  interval?: number; // in milliseconds
  enabled?: boolean;
  saveOnUnmount?: boolean;
}

interface UseAutoSaveReturn<T> {
  value: T;
  setValue: (value: T) => void;
  save: () => void;
  clear: () => void;
  status: 'idle' | 'pending' | 'saved' | 'error';
  error: Error | null;
  lastSaved: number | null;
}

export function useAutoSave<T>(
  key: string,
  defaultValue: T,
  options: UseAutoSaveOptions = {}
): UseAutoSaveReturn<T> {
  const {
    interval = 10000, // 10 seconds default
    enabled = true,
    saveOnUnmount = false,
  } = options;

  // Load initial value from localStorage
  const getInitialValue = (): T => {
    if (typeof window === 'undefined') return defaultValue;
    
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with default value to ensure all fields are present
        return { ...defaultValue, ...parsed };
      }
    } catch (error) {
      console.error(`Error loading auto-save data for ${key}:`, error);
    }
    
    return defaultValue;
  };

  const [value, setValueState] = useState<T>(getInitialValue);
  const [status, setStatus] = useState<UseAutoSaveReturn<T>['status']>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const valueRef = useRef<T>(value);
  
  // Update ref when value changes
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  
  // Save function
  const save = useCallback(() => {
    if (!enabled) return;
    
    try {
      localStorage.setItem(key, JSON.stringify(valueRef.current));
      setStatus('saved');
      setError(null);
      setLastSaved(Date.now());
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save');
      setError(error);
      setStatus('error');
      console.error(`Error saving auto-save data for ${key}:`, error);
    }
  }, [key, enabled]);
  
  // Clear function
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setValueState(defaultValue);
      setStatus('idle');
      setError(null);
      setLastSaved(null);
      
      // Cancel any pending save
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to clear');
      setError(error);
      console.error(`Error clearing auto-save data for ${key}:`, error);
    }
  }, [key, defaultValue]);
  
  // Set value function
  const setValue = useCallback((newValue: T) => {
    setValueState(newValue);
    setStatus('pending');
    
    // Cancel previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout for auto-save
    if (enabled) {
      timeoutRef.current = setTimeout(() => {
        save();
      }, interval);
    }
  }, [enabled, interval, save]);
  
  // Auto-save on interval
  useEffect(() => {
    if (!enabled || status !== 'pending') return;
    
    const timeout = setTimeout(() => {
      save();
    }, interval);
    
    return () => clearTimeout(timeout);
  }, [value, enabled, interval, save, status]);
  
  // Handle storage events (sync across tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setValueState({ ...defaultValue, ...parsed });
          setStatus('saved');
        } catch (error) {
          console.error('Error parsing storage event:', error);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, defaultValue]);
  
  // Save on unmount if configured
  useEffect(() => {
    return () => {
      if (saveOnUnmount && valueRef.current !== defaultValue) {
        try {
          localStorage.setItem(key, JSON.stringify(valueRef.current));
        } catch (error) {
          console.error('Error saving on unmount:', error);
        }
      }
    };
  }, [key, saveOnUnmount, defaultValue]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return {
    value,
    setValue,
    save,
    clear,
    status,
    error,
    lastSaved,
  };
}