'use client';

import { AuthProvider } from '@mindscript/auth/hooks';
import { MiniPlayer } from '@/components/MiniPlayer';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <MiniPlayer />
    </AuthProvider>
  );
}