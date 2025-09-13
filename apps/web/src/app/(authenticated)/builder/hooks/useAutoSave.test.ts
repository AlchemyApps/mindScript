import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useAutoSave', () => {
  const storageKey = 'test-draft';
  const defaultValue = { text: '' };

  beforeEach(() => {
    vi.useFakeTimers();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial Load', () => {
    it('returns default value when no saved data exists', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue)
      );
      
      expect(result.current.value).toEqual(defaultValue);
      expect(localStorageMock.getItem).toHaveBeenCalledWith(storageKey);
    });

    it('loads saved data from localStorage', () => {
      const savedData = { text: 'Saved content' };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedData));
      
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue)
      );
      
      expect(result.current.value).toEqual(savedData);
    });

    it('handles corrupted localStorage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json {');
      
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue)
      );
      
      expect(result.current.value).toEqual(defaultValue);
    });

    it('merges saved data with default value for partial data', () => {
      const savedData = { text: 'Saved content' };
      const fullDefault = { text: '', settings: { speed: 1 } };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedData));
      
      const { result } = renderHook(() => 
        useAutoSave(storageKey, fullDefault)
      );
      
      expect(result.current.value).toEqual({
        text: 'Saved content',
        settings: { speed: 1 },
      });
    });
  });

  describe('Auto-save Behavior', () => {
    it('saves after specified interval', async () => {
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue, { interval: 5000 })
      );
      
      act(() => {
        result.current.setValue({ text: 'New content' });
      });
      
      // Should not save immediately
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      
      // Fast-forward 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          storageKey,
          JSON.stringify({ text: 'New content' })
        );
      });
    });

    it('uses default interval of 10 seconds', async () => {
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue)
      );
      
      act(() => {
        result.current.setValue({ text: 'New content' });
      });
      
      // Fast-forward 9 seconds - should not save yet
      act(() => {
        vi.advanceTimersByTime(9000);
      });
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      
      // Fast-forward 1 more second
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalled();
      });
    });

    it('debounces rapid changes', async () => {
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue, { interval: 5000 })
      );
      
      // Make multiple rapid changes
      act(() => {
        result.current.setValue({ text: 'Change 1' });
      });
      act(() => {
        vi.advanceTimersByTime(1000);
        result.current.setValue({ text: 'Change 2' });
      });
      act(() => {
        vi.advanceTimersByTime(1000);
        result.current.setValue({ text: 'Change 3' });
      });
      
      // Auto-save should not have triggered yet
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      
      // Fast-forward to complete the interval from last change
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          storageKey,
          JSON.stringify({ text: 'Change 3' })
        );
      });
    });

    it('does not save when disabled', () => {
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue, { enabled: false })
      );
      
      act(() => {
        result.current.setValue({ text: 'New content' });
      });
      
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('can be disabled after initialization', () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useAutoSave(storageKey, defaultValue, { enabled }),
        { initialProps: { enabled: true } }
      );
      
      act(() => {
        result.current.setValue({ text: 'New content' });
      });
      
      // Disable auto-save
      rerender({ enabled: false });
      
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Manual Save', () => {
    it('provides manual save function', async () => {
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue)
      );
      
      act(() => {
        result.current.setValue({ text: 'Manual save content' });
        result.current.save();
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        storageKey,
        JSON.stringify({ text: 'Manual save content' })
      );
    });

    it('resets auto-save timer after manual save', async () => {
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue, { interval: 5000 })
      );
      
      act(() => {
        result.current.setValue({ text: 'Content' });
      });
      
      // Fast-forward 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      
      // Manual save
      act(() => {
        result.current.save();
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
      
      // Fast-forward 3 more seconds (total 6 seconds from start)
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      
      // Should not have auto-saved again yet (timer was reset)
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
      
      // Fast-forward 2 more seconds (5 seconds from manual save)
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Clear Functionality', () => {
    it('provides clear function to remove saved data', () => {
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue)
      );
      
      act(() => {
        result.current.setValue({ text: 'Content to clear' });
        result.current.save();
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      act(() => {
        result.current.clear();
      });
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(storageKey);
      expect(result.current.value).toEqual(defaultValue);
    });

    it('cancels pending auto-save when cleared', () => {
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue, { interval: 5000 })
      );
      
      act(() => {
        result.current.setValue({ text: 'Content' });
      });
      
      act(() => {
        vi.advanceTimersByTime(3000);
        result.current.clear();
      });
      
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      
      // Should only have the removeItem call, no setItem
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(storageKey);
    });
  });

  describe('Status Tracking', () => {
    it('tracks saving status', async () => {
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue, { interval: 5000 })
      );
      
      expect(result.current.status).toBe('idle');
      
      act(() => {
        result.current.setValue({ text: 'Content' });
      });
      
      expect(result.current.status).toBe('pending');
      
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(result.current.status).toBe('saved');
      });
    });

    it('shows error status on save failure', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });
      
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue, { interval: 5000 })
      );
      
      act(() => {
        result.current.setValue({ text: 'Content' });
      });
      
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      
      await waitFor(() => {
        expect(result.current.status).toBe('error');
        expect(result.current.error).toEqual(new Error('Storage full'));
      });
    });

    it('provides last saved timestamp', async () => {
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue)
      );
      
      const beforeSave = Date.now();
      
      act(() => {
        result.current.setValue({ text: 'Content' });
        result.current.save();
      });
      
      expect(result.current.lastSaved).toBeGreaterThanOrEqual(beforeSave);
      expect(result.current.lastSaved).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Cleanup', () => {
    it('cleans up timers on unmount', () => {
      const { result, unmount } = renderHook(() => 
        useAutoSave(storageKey, defaultValue, { interval: 5000 })
      );
      
      act(() => {
        result.current.setValue({ text: 'Content' });
      });
      
      unmount();
      
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      
      // Should not save after unmount
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('saves pending changes before unmount if configured', () => {
      const { result, unmount } = renderHook(() => 
        useAutoSave(storageKey, defaultValue, { 
          interval: 5000,
          saveOnUnmount: true 
        })
      );
      
      act(() => {
        result.current.setValue({ text: 'Unsaved content' });
      });
      
      unmount();
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        storageKey,
        JSON.stringify({ text: 'Unsaved content' })
      );
    });
  });

  describe('Storage Events', () => {
    it('syncs with other tabs/windows', () => {
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue)
      );
      
      // Simulate storage event from another tab
      const storageEvent = new StorageEvent('storage', {
        key: storageKey,
        newValue: JSON.stringify({ text: 'Content from other tab' }),
        storageArea: localStorage,
      });
      
      act(() => {
        window.dispatchEvent(storageEvent);
      });
      
      expect(result.current.value).toEqual({ text: 'Content from other tab' });
    });

    it('ignores storage events for other keys', () => {
      const { result } = renderHook(() => 
        useAutoSave(storageKey, defaultValue)
      );
      
      act(() => {
        result.current.setValue({ text: 'My content' });
      });
      
      const storageEvent = new StorageEvent('storage', {
        key: 'other-key',
        newValue: JSON.stringify({ text: 'Other content' }),
        storageArea: localStorage,
      });
      
      act(() => {
        window.dispatchEvent(storageEvent);
      });
      
      expect(result.current.value).toEqual({ text: 'My content' });
    });
  });
});