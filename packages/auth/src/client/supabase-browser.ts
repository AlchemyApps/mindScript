import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase browser client for RLS-protected reads only.
 * DO NOT use this for auth operations - all auth should go through server endpoints.
 *
 * This client is stateless and doesn't maintain a singleton to avoid
 * any potential hanging issues.
 */
export function getSupabaseBrowserClient(): SupabaseClient<any, 'public', any> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing required Supabase environment variables');
  }

  // Create a new client each time - no singleton pattern
  // This is safe for RLS reads and avoids hanging issues
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );
}

// Alias for backward compatibility
export const supabaseBrowser = getSupabaseBrowserClient;