import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  console.log('[API] Logout request received');

  try {
    const supabase = await createClient();

    // Clear the session
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[API] Logout error:', error);
      // Don't fail the request - we still want to clear cookies
    }

    // Clear all auth-related cookies manually
    const cookieStore = await cookies();

    // Common Supabase auth cookie patterns
    const authCookiePatterns = [
      'sb-access-token',
      'sb-refresh-token',
      'sb-auth-token',
      'supabase-auth-token'
    ];

    // Get all cookies and clear auth-related ones
    cookieStore.getAll().forEach(cookie => {
      if (cookie.name.includes('sb-') ||
          cookie.name.includes('supabase') ||
          authCookiePatterns.some(pattern => cookie.name.includes(pattern))) {
        cookieStore.delete(cookie.name);
      }
    });

    console.log('[API] Logout successful, cookies cleared');

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('[API] Unexpected logout error:', error);

    // Still return success - we want the user to be logged out client-side
    return NextResponse.json({
      success: true,
      message: 'Logout completed with warnings',
      warning: 'Some cleanup operations may have failed'
    });
  }
}