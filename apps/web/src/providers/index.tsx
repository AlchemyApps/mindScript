'use client';

import { AuthProvider } from '@mindscript/auth/hooks';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}