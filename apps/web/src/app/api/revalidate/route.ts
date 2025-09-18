import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

// Secret for securing the revalidation endpoint
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Verify the secret token
    const headersList = headers();
    const authorization = headersList.get('authorization');
    const token = authorization?.replace('Bearer ', '');

    if (!REVALIDATE_SECRET || token !== REVALIDATE_SECRET) {
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 401 }
      );
    }

    // Get the revalidation parameters
    const body = await request.json();
    const { type, path, tag, sellerSlug, trackSlug } = body;

    // Validate required parameters
    if (!type) {
      return NextResponse.json(
        { error: 'Missing type parameter' },
        { status: 400 }
      );
    }

    const revalidated: string[] = [];

    switch (type) {
      case 'seller':
        // Revalidate seller profile page
        if (!sellerSlug) {
          return NextResponse.json(
            { error: 'Missing sellerSlug parameter for seller revalidation' },
            { status: 400 }
          );
        }
        revalidatePath(`/u/${sellerSlug}`);
        revalidated.push(`/u/${sellerSlug}`);

        // Also revalidate all tracks for this seller
        const supabase = await createClient();
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', sellerSlug.toLowerCase())
          .single();

        if (profile) {
          const { data: tracks } = await supabase
            .from('tracks')
            .select('title')
            .eq('user_id', profile.id)
            .eq('status', 'published')
            .eq('is_public', true);

          if (tracks) {
            for (const track of tracks) {
              const slug = track.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
              revalidatePath(`/u/${sellerSlug}/${slug}`);
              revalidated.push(`/u/${sellerSlug}/${slug}`);
            }
          }
        }
        break;

      case 'track':
        // Revalidate specific track page
        if (!sellerSlug || !trackSlug) {
          return NextResponse.json(
            { error: 'Missing sellerSlug or trackSlug parameter for track revalidation' },
            { status: 400 }
          );
        }
        revalidatePath(`/u/${sellerSlug}/${trackSlug}`);
        revalidated.push(`/u/${sellerSlug}/${trackSlug}`);

        // Also revalidate the seller profile page
        revalidatePath(`/u/${sellerSlug}`);
        revalidated.push(`/u/${sellerSlug}`);
        break;

      case 'path':
        // Revalidate a specific path
        if (!path) {
          return NextResponse.json(
            { error: 'Missing path parameter for path revalidation' },
            { status: 400 }
          );
        }
        revalidatePath(path);
        revalidated.push(path);
        break;

      case 'tag':
        // Revalidate by cache tag
        if (!tag) {
          return NextResponse.json(
            { error: 'Missing tag parameter for tag revalidation' },
            { status: 400 }
          );
        }
        revalidateTag(tag);
        revalidated.push(`tag:${tag}`);
        break;

      case 'all':
        // Revalidate all public pages
        revalidatePath('/');
        revalidatePath('/u/[sellerSlug]', 'page');
        revalidatePath('/u/[sellerSlug]/[trackSlug]', 'page');
        revalidated.push('all pages');
        break;

      default:
        return NextResponse.json(
          { error: `Invalid revalidation type: ${type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      revalidated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json(
      { error: 'Internal server error during revalidation' },
      { status: 500 }
    );
  }
}

// GET method to check if the endpoint is working
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Revalidation endpoint is active. Use POST with proper authentication to trigger revalidation.',
    endpoints: {
      seller: {
        description: 'Revalidate a seller profile and all their tracks',
        params: { type: 'seller', sellerSlug: 'username' },
      },
      track: {
        description: 'Revalidate a specific track and its seller profile',
        params: { type: 'track', sellerSlug: 'username', trackSlug: 'track-slug' },
      },
      path: {
        description: 'Revalidate a specific path',
        params: { type: 'path', path: '/path/to/revalidate' },
      },
      tag: {
        description: 'Revalidate by cache tag',
        params: { type: 'tag', tag: 'cache-tag-name' },
      },
      all: {
        description: 'Revalidate all public pages',
        params: { type: 'all' },
      },
    },
  });
}