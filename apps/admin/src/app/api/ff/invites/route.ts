import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/** GET: List all F&F invites */
export async function GET() {
  try {
    const { data: invites, error } = await supabaseAdmin
      .from('ff_invites')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
    }

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('[ADMIN-FF] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST: Create a new invite (proxies to web app API pattern) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, tier } = body;

    if (!email || !tier || !['inner_circle', 'cost_pass'].includes(tier)) {
      return NextResponse.json(
        { error: 'email and tier (inner_circle|cost_pass) are required' },
        { status: 400 }
      );
    }

    const crypto = await import('crypto');
    const code = crypto.randomBytes(6).toString('hex');

    const { data: invite, error } = await supabaseAdmin
      .from('ff_invites')
      .insert({
        code,
        email: email.toLowerCase().trim(),
        tier,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[ADMIN-FF] Failed to create invite:', error);
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }

    // Send invite email (best effort)
    if (process.env.RESEND_API_KEY) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://mindscript.studio';
        const inviteUrl = `${appUrl}/invite/${code}`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'MindScript <noreply@mindscript.studio>',
            to: email,
            subject: "You're invited to try MindScript",
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #1a1a1a; font-size: 24px; text-align: center;">You're Invited to MindScript</h1>
                <p style="color: #525252; font-size: 16px; line-height: 24px;">
                  You've been invited to join MindScript's Friends & Family program with
                  ${tier === 'inner_circle' ? 'full free access to everything' : 'access at cost (AI processing fees only)'}.
                </p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${inviteUrl}" style="background-color: #6C63FF; border-radius: 8px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: 600; padding: 12px 32px; text-decoration: none;">
                    Accept Invitation
                  </a>
                </div>
                <p style="color: #9ca3af; font-size: 14px; text-align: center;">MindScript</p>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.error('[ADMIN-FF] Email send failed:', emailErr);
      }
    }

    return NextResponse.json({ invite });
  } catch (error) {
    console.error('[ADMIN-FF] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
