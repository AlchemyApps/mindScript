import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@mindscript/auth/server';

/**
 * POST /api/profile/cancel-deletion - Cancel a scheduled account deletion
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if deletion is actually pending
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('deletion_requested_at, deletion_scheduled_for')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (!profile.deletion_requested_at) {
      return NextResponse.json(
        { error: 'No pending deletion to cancel' },
        { status: 400 }
      );
    }

    // Clear deletion flags
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        deletion_requested_at: null,
        deletion_scheduled_for: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to cancel deletion:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel account deletion' },
        { status: 500 }
      );
    }

    // Log cancellation
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'account_deletion_cancelled',
        metadata: {
          timestamp: new Date().toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        }
      });

    return NextResponse.json({
      message: 'Account deletion has been cancelled. Your account is fully active.',
    });
  } catch (error) {
    console.error('Error cancelling account deletion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
