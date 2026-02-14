import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@mindscript/auth/server';
import { createClient } from '@supabase/supabase-js';
import { accountDeletionRequestSchema } from '@mindscript/schemas';
import { z } from 'zod';

/**
 * Get an authenticated Supabase client from either:
 * 1. Bearer token (mobile app) — creates a standalone client with the token
 * 2. Cookies (web app) — uses the SSR cookie-based client
 */
async function getAuthenticatedClient(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }
  return await createServerClient();
}

/**
 * POST /api/profile/delete-account - Schedule account for deletion (30-day grace period)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getAuthenticatedClient(request);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = accountDeletionRequestSchema.parse(body);

    // Verify password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: validatedData.password
    });

    if (signInError) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Check for active subscriptions or pending payments
    const { data: activeSubscriptions } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1);

    if (activeSubscriptions && activeSubscriptions.length > 0) {
      return NextResponse.json(
        { error: 'Please cancel all active subscriptions before deleting your account' },
        { status: 400 }
      );
    }

    // Check for pending renders
    const { data: pendingRenders } = await supabase
      .from('audio_renders')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .limit(1);

    if (pendingRenders && pendingRenders.length > 0) {
      return NextResponse.json(
        { error: 'Please wait for all pending renders to complete before deleting your account' },
        { status: 400 }
      );
    }

    // Calculate deletion date (30 days from now)
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    // Set soft-delete flags on profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        deletion_requested_at: new Date().toISOString(),
        deletion_scheduled_for: deletionDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to set deletion flags:', updateError);
      return NextResponse.json(
        { error: 'Failed to schedule account deletion. Please contact support.' },
        { status: 500 }
      );
    }

    // Log account deletion request
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'account_deletion_requested',
        metadata: {
          reason: validatedData.reason,
          scheduled_for: deletionDate.toISOString(),
          timestamp: new Date().toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        }
      });

    // Sign out the user
    await supabase.auth.signOut();

    return NextResponse.json({
      message: 'Your account has been scheduled for deletion on ' +
        deletionDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
        '. You can cancel by logging back in within 30 days.',
      deletion_scheduled_for: deletionDate.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error scheduling account deletion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
