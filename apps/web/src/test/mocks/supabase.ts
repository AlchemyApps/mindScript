import { vi } from 'vitest';

export function createMockSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
    rpc: vi.fn(),
  };
}

// Mock the auth server module
export const mockCreateServerClient = vi.fn(() => createMockSupabaseClient());