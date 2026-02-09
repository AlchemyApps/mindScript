import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { serverSupabase } from '@/lib/supabase/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function requireAdmin() {
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, role_flags')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role_flags?.is_admin;
  return isAdmin ? user : null;
}

/** PATCH: Revoke or resend an invite */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'revoke') {
      const { data: invite, error: inviteError } = await supabaseAdmin
        .from('ff_invites')
        .update({ status: 'revoked' })
        .eq('id', id)
        .select()
        .single();

      if (inviteError) {
        return NextResponse.json({ error: 'Failed to revoke invite' }, { status: 500 });
      }

      if (invite.redeemed_by) {
        await supabaseAdmin
          .from('profiles')
          .update({ ff_tier: null })
          .eq('id', invite.redeemed_by);
      }

      return NextResponse.json({ invite });
    }

    if (action === 'resend') {
      const { data: invite, error: fetchError } = await supabaseAdmin
        .from('ff_invites')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !invite || invite.status !== 'pending') {
        return NextResponse.json(
          { error: 'Invite not found or not in pending status' },
          { status: 400 }
        );
      }

      if (process.env.RESEND_API_KEY) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mindscript.studio';
        const inviteUrl = `${appUrl}/invite/${invite.code}`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'MindScript <noreply@mindscript.studio>',
            to: invite.email,
            subject: 'Reminder: You\'re invited to try MindScript',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #1a1a1a; font-size: 24px; text-align: center;">Reminder: You're Invited!</h1>
                <p style="color: #525252; font-size: 16px; line-height: 24px;">
                  You have a pending invitation to join MindScript's Friends & Family program.
                </p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${inviteUrl}" style="background-color: #6C63FF; border-radius: 8px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: 600; padding: 12px 32px; text-decoration: none;">
                    Accept Invitation
                  </a>
                </div>
                <p style="color: #9ca3af; font-size: 14px; text-align: center;">
                  MindScript · Transform your mind through sound
                </p>
              </div>
            `,
            tags: [{ name: 'template', value: 'ff-invite-resend' }],
          }),
        });
      }

      return NextResponse.json({ invite, emailSent: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[FF-INVITE] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
