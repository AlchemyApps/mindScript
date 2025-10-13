import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '../../../../lib/supabase/server';
import { z } from 'zod';

// Request validation
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
  trackConfig: z.any().optional(), // Track configuration from guest builder
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

    const { email, password, next = "/library", trackConfig } = validation.data;
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

    // Store track config temporarily if provided
    let destinationPath = next;
    if (trackConfig && data.user) {
      const tempTrackId = crypto.randomUUID();
      const { error: trackError } = await supabase
        .from('pending_tracks')
        .insert({
          id: tempTrackId,
          user_email: email.toLowerCase(),
          track_config: trackConfig,
          created_at: new Date().toISOString()
        });

      if (!trackError) {
        destinationPath = "/api/checkout/create";
        const url = new URL(destinationPath, process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin);
        url.searchParams.set("track_id", tempTrackId);
        console.log('[LOGIN] Will redirect to checkout:', url.toString());
        destinationPath = url.toString();
      } else {
        console.error('[LOGIN] Failed to store pending track:', trackError);
      }
    }

    // Prepare redirect URL
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
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