import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { InviteRedeemClient } from './InviteRedeemClient';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface Props {
  params: Promise<{ code: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { code } = await params;

  // Validate the invite code
  const { data: invite, error } = await supabaseAdmin
    .from('ff_invites')
    .select('id, code, email, tier, status')
    .eq('code', code)
    .single();

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Invite</h1>
          <p className="text-gray-600">This invitation link is not valid. Please check the link or contact the person who invited you.</p>
        </div>
      </div>
    );
  }

  if (invite.status === 'revoked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invite Revoked</h1>
          <p className="text-gray-600">This invitation has been revoked. Please contact the person who invited you for a new link.</p>
        </div>
      </div>
    );
  }

  if (invite.status === 'redeemed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Already Redeemed</h1>
          <p className="text-gray-600">This invitation has already been used. If you already activated it, you can sign in to start using MindScript.</p>
          <a href="/sign-in" className="mt-4 inline-block px-6 py-3 bg-[#6C63FF] text-white rounded-lg font-semibold hover:bg-[#5b54e6] transition-colors">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  const tierLabel = invite.tier === 'inner_circle' ? 'Inner Circle' : 'Cost Pass';
  const tierDescription = invite.tier === 'inner_circle'
    ? 'Full free access to create tracks, use premium voices, and access all features.'
    : 'Access at cost — you only pay the AI processing fees, no markup.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-md w-full px-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#6C63FF] to-[#10B981] flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            You&apos;re Invited!
          </h1>
          <p className="text-gray-600 mb-1">
            Welcome to MindScript&apos;s Friends &amp; Family program.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              invite.tier === 'inner_circle'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {tierLabel}
            </span>
          </div>
          <p className="text-gray-600 text-sm">{tierDescription}</p>
        </div>

        <InviteRedeemClient code={code} tier={invite.tier} email={invite.email} />
      </div>
    </div>
  );
}
