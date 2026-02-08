'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Drawer({ isOpen, onClose, title, children, className }: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={cn(
          'absolute top-0 right-0 h-full',
          'w-full sm:w-[480px]',
          'bg-white shadow-2xl',
          'flex flex-col',
          'animate-slide-in-right',
          className
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold font-heading text-text text-lg">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-muted hover:text-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Close button if no title */}
        {!title && (
          <div className="flex justify-end px-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-muted hover:text-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
