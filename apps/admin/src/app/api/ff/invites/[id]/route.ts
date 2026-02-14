import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@mindscript/auth/server';

const supabaseAdmin = createServiceRoleClient();

/** PATCH: Revoke or resend an invite */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'revoke') {
      const { data: invite, error } = await supabaseAdmin
        .from('ff_invites')
        .update({ status: 'revoked' })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: 'Failed to revoke invite' }, { status: 500 });
      }

      // Clear ff_tier from the user's profile if they already redeemed
      if (invite.redeemed_by) {
        await supabaseAdmin
          .from('profiles')
          .update({ ff_tier: null })
          .eq('id', invite.redeemed_by);
      }

      return NextResponse.json({ invite });
    }

    if (action === 'resend') {
      const { data: invite, error } = await supabaseAdmin
        .from('ff_invites')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !invite || invite.status !== 'pending') {
        return NextResponse.json({ error: 'Invite not found or not pending' }, { status: 400 });
      }

      if (process.env.RESEND_API_KEY) {
        const appUrl = process.env.NEXT_PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://mindscript.studio';
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
            subject: "Reminder: You're invited to try MindScript",
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #1a1a1a; font-size: 24px; text-align: center;">Reminder: You're Invited!</h1>
                <p style="color: #525252; font-size: 16px;">You have a pending invitation to join MindScript's Friends & Family program.</p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${inviteUrl}" style="background-color: #6C63FF; border-radius: 8px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: 600; padding: 12px 32px; text-decoration: none;">Accept Invitation</a>
                </div>
              </div>
            `,
          }),
        });
      }

      return NextResponse.json({ invite, emailSent: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[ADMIN-FF] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
