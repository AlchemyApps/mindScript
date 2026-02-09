import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '../../../../lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/** POST: Redeem an F&F invite code */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user via cookies
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    // Atomically update the invite: only works if status is 'pending'
    const { data: invite, error: updateError } = await supabaseAdmin
      .from('ff_invites')
      .update({
        status: 'redeemed',
        redeemed_by: user.id,
        redeemed_at: new Date().toISOString(),
      })
      .eq('code', code)
      .eq('status', 'pending')
      .select()
      .single();

    if (updateError || !invite) {
      return NextResponse.json(
        { error: 'Invalid or already-used invite code' },
        { status: 400 }
      );
    }

    // Set the user's ff_tier on their profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ ff_tier: invite.tier })
      .eq('id', user.id);

    if (profileError) {
      console.error('[FF-REDEEM] Failed to update profile ff_tier:', profileError);
      // Rollback the invite status
      await supabaseAdmin
        .from('ff_invites')
        .update({ status: 'pending', redeemed_by: null, redeemed_at: null })
        .eq('id', invite.id);
      return NextResponse.json({ error: 'Failed to activate access' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tier: invite.tier,
    });
  } catch (error) {
    console.error('[FF-REDEEM] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
