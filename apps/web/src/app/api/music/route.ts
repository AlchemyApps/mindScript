import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  try {
    const { data: tracks, error } = await supabaseAdmin
      .from('background_tracks')
      .select('id, title, slug, description, category, bpm, key:key_signature, price_cents, duration_seconds, attributes, url')
      .eq('is_active', true)
      .eq('is_platform_asset', true)
      .order('category')
      .order('title');

    if (error) {
      console.error('[MUSIC-API] Error fetching tracks:', error);
      return NextResponse.json({ error: 'Failed to fetch music catalog' }, { status: 500 });
    }

    // Resolve public storage URLs
    const tracksWithUrls = (tracks || []).map((track) => {
      const { data: urlData } = supabaseAdmin.storage
        .from('background-music')
        .getPublicUrl(track.url);

      return {
        ...track,
        previewUrl: urlData?.publicUrl || '',
      };
    });

    return NextResponse.json({ tracks: tracksWithUrls });
  } catch (error) {
    console.error('[MUSIC-API] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
