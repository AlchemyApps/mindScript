import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { checkTrackAccess, generateSignedUrl } from '@/lib/track-access';
import { createUserRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trackId = params.id;

    // Validate track ID format
    if (!trackId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackId)) {
      return NextResponse.json(
        { error: 'Invalid track ID format' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Apply rate limiting
    const rateLimiter = createUserRateLimit(user.id, RATE_LIMITS.download);
    const rateLimit = rateLimiter(request);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retry_after: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'x-ratelimit-limit': RATE_LIMITS.download.max.toString(),
            'x-ratelimit-remaining': rateLimit.remaining.toString(),
            'x-ratelimit-reset': new Date(rateLimit.resetTime).toISOString(),
          },
        }
      );
    }

    // Check track access (ownership or purchase)
    const accessCheck = await checkTrackAccess(trackId, user.id, supabase);
    if (!accessCheck.hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this track' },
        { status: 403 }
      );
    }

    const trackInfo = accessCheck.track;

    // Check if audio file is available
    if (!trackInfo.audio_url) {
      return NextResponse.json(
        { error: 'Audio file not available' },
        { status: 404 }
      );
    }

    // Generate signed URL (short expiry for immediate download)
    const { signedUrl, error } = await generateSignedUrl(trackInfo.audio_url, 300, supabase); // 5 minutes

    if (error || !signedUrl) {
      console.error('Failed to generate download URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      );
    }

    // Increment download count
    await supabase
      .from('tracks')
      .update({ download_count: (trackInfo.download_count || 0) + 1 })
      .eq('id', trackId);

    // Fetch the file from storage
    const fileResponse = await fetch(signedUrl);

    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch audio file' },
        { status: 500 }
      );
    }

    // Get the file content
    const fileBuffer = await fileResponse.arrayBuffer();

    // Clean filename for download
    const cleanTitle = trackInfo.title.replace(/[^a-z0-9\s\-_]/gi, '').trim();
    const filename = `${cleanTitle || 'track'}.mp3`;

    // Stream the file directly to the client with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'content-type': 'audio/mpeg',
        'content-disposition': `attachment; filename="${filename}"`,
        'content-length': fileBuffer.byteLength.toString(),
        'cache-control': 'no-cache, no-store, must-revalidate',
        'x-content-type-options': 'nosniff',
        'x-ratelimit-limit': RATE_LIMITS.download.max.toString(),
        'x-ratelimit-remaining': rateLimit.remaining.toString(),
        'x-ratelimit-reset': new Date(rateLimit.resetTime).toISOString(),
      },
    });
  } catch (error) {
    console.error('Download stream error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}