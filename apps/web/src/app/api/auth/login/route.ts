import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '../../../../lib/supabase/server';
import { z } from 'zod';

// Request validation
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function POST(request: NextRequest) {
  console.log('[API] Login request received');

  try {
    const body = await request.json();
    const validation = LoginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, next = "/library" } = validation.data;
    console.log('[API] Attempting login for:', email);

    // Create Supabase client
    const supabase = await serverSupabase();

    // Sign in the user
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (error) {
      console.error('[API] Login error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data?.user) {
      console.error('[API] No user returned from login');
      return NextResponse.json(
        { error: "Login failed - no user returned" },
        { status: 500 }
      );
    }

    console.log('[API] Login successful for:', email);
    console.log('[API] User ID:', data.user.id);

    // Prepare redirect URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const destinationPath = next || '/library';
    const url = destinationPath.startsWith('http')
      ? new URL(destinationPath)
      : new URL(destinationPath, siteUrl);

    console.log('[LOGIN] Returning redirect URL:', url.toString());

    // Return JSON with redirect URL
    // The cookies are already set by Supabase auth.signInWithPassword
    return NextResponse.json({
      success: true,
      redirectUrl: url.toString(),
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });

  } catch (error: any) {
    console.error('[API] Unexpected login error:', error);
    return NextResponse.json(
      { error: "An unexpected error occurred during login" },
      { status: 500 }
    );
  }
}
