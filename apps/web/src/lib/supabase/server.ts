import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function serverSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (error) {
            // Cookie setting can fail in certain contexts (e.g., static generation)
            console.error('Cookie setting error:', error);
          }
        },
      },
    }
  );
}

// Keep backward compatibility
export const createClient = serverSupabase;

// Helper function to get user from request
export async function getUser() {
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}