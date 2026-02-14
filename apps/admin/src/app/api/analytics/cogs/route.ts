import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@mindscript/auth/server';

const supabaseAdmin = createServiceRoleClient();

function getPeriodDates(period: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }

  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const { start, end } = getPeriodDates(period);

    const { data, error } = await supabaseAdmin.rpc('get_cogs_analytics', {
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    });

    if (error) {
      console.error('[COGS-ANALYTICS] RPC error:', error);
      return NextResponse.json({ error: 'Failed to fetch COGS analytics' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[COGS-ANALYTICS] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
