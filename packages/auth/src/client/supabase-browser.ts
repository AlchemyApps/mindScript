import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient<any, 'public', any> | undefined;

export function getSupabaseBrowserClient(): SupabaseClient<any, 'public', any> {
  if (!browserClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing required Supabase environment variables');
    }

    browserClient = createBrowserClient(
      supabaseUrl,
      supabaseAnonKey
    );
  }

  return browserClient as SupabaseClient<any, 'public', any>;
}