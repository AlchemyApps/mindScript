import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface EditEligibility {
  canEdit: boolean;
  editCount: number;
  freeEditsRemaining: number;
  baseFee: number;
  premiumUpgradeFees: Record<string, number>;
  totalFee: number;
  reason?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trackId } = await params;
  const userId = request.headers.get('x-user-id');

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch track with ownership check
    const { data: track, error: trackError } = await supabaseAdmin
      .from('tracks')
      .select('id, user_id, edit_count, voice_config, music_config, frequency_config, status')
      .eq('id', trackId)
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    if (track.user_id !== userId) {
      return NextResponse.json({ error: 'Not authorized to edit this track' }, { status: 403 });
    }

    if (track.status === 'archived') {
      return NextResponse.json({
        canEdit: false,
        reason: 'Archived tracks cannot be edited',
      } satisfies Partial<EditEligibility>);
    }

    // Fetch admin settings
    const { data: settings } = await supabaseAdmin
      .from('admin_settings')
      .select('key, value')
      .in('key', ['edit_fee_cents', 'free_edit_limit']);

    const editFeeCents = Number(settings?.find(s => s.key === 'edit_fee_cents')?.value ?? 49);
    const freeEditLimit = Number(settings?.find(s => s.key === 'free_edit_limit')?.value ?? 3);

    const editCount = track.edit_count || 0;
    const freeEditsRemaining = Math.max(0, freeEditLimit - editCount);
    const requiresPayment = editCount >= freeEditLimit;

    const result: EditEligibility = {
      canEdit: true,
      editCount,
      freeEditsRemaining,
      baseFee: requiresPayment ? editFeeCents : 0,
      premiumUpgradeFees: {},
      totalFee: requiresPayment ? editFeeCents : 0,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[EDIT-ELIGIBILITY] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
