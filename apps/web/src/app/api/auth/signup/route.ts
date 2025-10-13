import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "../../../../lib/supabase/server";
import { z } from "zod";

// Request validation
const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().optional(),
  trackConfig: z.any().optional(), // Track configuration from guest builder
});

export async function POST(request: NextRequest) {
  console.log('[API] Signup request received');

  try {
    const body = await request.json();
    const validation = SignupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, fullName, trackConfig } = validation.data;
    console.log('[API] Attempting signup for:', email);

    // Create Supabase client
    const supabase = await serverSupabase();

    // Store track config temporarily if provided
    let tempTrackId: string | undefined;
    if (trackConfig) {
      tempTrackId = crypto.randomUUID();
      const { error: trackError } = await supabase
        .from('pending_tracks')
        .insert({
          id: tempTrackId,
          user_email: email.toLowerCase(),
          track_config: trackConfig,
          created_at: new Date().toISOString()
        });

      if (trackError) {
        console.error('[API] Failed to store pending track:', trackError);
        // Continue anyway - not critical
      }
    }

    // Attempt signup
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName,
          temp_track_id: tempTrackId,
        },
      },
    });

    if (error) {
      console.error('[API] Signup error:', error);

      // Handle specific error cases
      if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
        return NextResponse.json(
          { error: "This email is already registered. Please sign in instead." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error.message || "Failed to create account" },
        { status: 400 }
      );
    }

    if (!data?.user) {
      console.error('[API] No user returned from signup');
      return NextResponse.json(
        { error: "Failed to create account - no user returned" },
        { status: 500 }
      );
    }

    console.log('[API] Signup successful for:', email);
    console.log('[API] User ID:', data.user.id);
    console.log('[API] Has session:', !!data.session);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

    // If email confirmation is required (no session)
    if (!data.session) {
      const url = new URL("/auth/verify", siteUrl);
      url.searchParams.set("email", email);
      if (tempTrackId) {
        url.searchParams.set("track_id", tempTrackId);
      }
      console.log('[SIGNUP] Email verification required, redirecting to:', url.toString());

      // Use 303 redirect to commit cookies properly
      return NextResponse.redirect(url, { status: 303 });
    }

    // Session created - prepare redirect URL
    const destinationPath = tempTrackId ? "/api/checkout/create" : "/library";
    const url = new URL(destinationPath, siteUrl);

    if (tempTrackId) {
      url.searchParams.set("track_id", tempTrackId);
    }

    console.log('[SIGNUP] Session created, returning redirect URL:', url.toString());

    // Return JSON with redirect URL
    // The cookies are already set by Supabase auth.signUp
    return NextResponse.json({
      success: true,
      redirectUrl: url.toString(),
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });

  } catch (error) {
    console.error('[API] Unexpected signup error:', error);
    return NextResponse.json(
      { error: "An unexpected error occurred during signup" },
      { status: 500 }
    );
  }
}