import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSignedUrl } from '@/lib/track-access';
import { z } from 'zod';

const TRACK_FIELDS_BASE = `
  id,
  user_id,
  title,
  description,
  script,
  voice_config,
  music_config,
  frequency_config,
  output_config,
  status,
  is_public,
  tags,
  render_job_id,
  audio_url,
  duration_seconds,
  play_count,
  price_cents,
  deleted_at,
  created_at,
  updated_at,
  profiles!user_id (display_name, avatar_url)
`;

// Query parameters schema
const querySchema = z.object({
  ownership: z.enum(['all', 'owned', 'purchased']).optional().default('all'),
  status: z.enum(['all', 'draft', 'rendering', 'published', 'failed']).optional().default('all'),
  search: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  sort: z.enum(['created_at', 'title', 'last_played', 'duration']).optional().default('created_at'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  includeRenderStatus: z.coerce.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const params = querySchema.parse({
      ownership: searchParams.get('ownership') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      tags: searchParams.get('tags') || undefined,
      sort: searchParams.get('sort') || undefined,
      order: searchParams.get('order') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      includeRenderStatus: searchParams.get('includeRenderStatus') || undefined,
    });

    const tracks: any[] = [];
    const trackSelect = `${TRACK_FIELDS_BASE}${
      params.includeRenderStatus
        ? `,
          audio_job_queue!track_id (id, status, progress, created_at)`
        : ''
    }`;
    
    // Fetch owned tracks
    if (params.ownership === 'all' || params.ownership === 'owned') {
      let ownedQuery = supabase
        .from('tracks')
        .select(trackSelect)
        .eq('user_id', user.id);

      // Don't filter by status at the database level when it's 'rendering' or 'failed'
      // as these come from the audio_job_queue
      if (params.status !== 'all' && params.status !== 'rendering' && params.status !== 'failed') {
        ownedQuery = ownedQuery.eq('status', params.status);
      }

      // Apply search filter
      if (params.search) {
        ownedQuery = ownedQuery.or(
          `title.ilike.%${params.search}%,description.ilike.%${params.search}%`
        );
      }

      // Apply tags filter
      if (params.tags) {
        const tagList = params.tags.split(',').map(t => t.trim());
        ownedQuery = ownedQuery.contains('tags', tagList);
      }

      // Apply sorting
      ownedQuery = ownedQuery.order(params.sort, { ascending: params.order === 'asc' });

      const { data: ownedTracks, error: ownedError } = await ownedQuery;
      
      if (ownedError) {
        console.error('Error fetching owned tracks:', ownedError);
        return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
      }

      // Add ownership type and derive combined status
      const ownedWithType = (ownedTracks || []).map(track => {
        // Derive combined status from track status and render job status
        let combinedStatus = track.status; // 'draft', 'published', or 'archived'

        // Check if there's an active render job
        if (track.audio_job_queue && track.audio_job_queue.length > 0) {
          const latestJob = track.audio_job_queue[0];
          if (latestJob.status === 'processing' || latestJob.status === 'pending') {
            combinedStatus = 'rendering';
          } else if (latestJob.status === 'failed') {
            combinedStatus = 'failed';
          }
        }

        return {
          ...track,
          duration: track.duration_seconds || 0, // Map duration_seconds to duration
          ownership: 'owned' as const,
          status: combinedStatus, // Override with combined status
          renderStatus: params.includeRenderStatus && track.audio_job_queue?.[0]
            ? {
                id: track.audio_job_queue[0].id,
                status: track.audio_job_queue[0].status,
                progress: track.audio_job_queue[0].progress,
                createdAt: track.audio_job_queue[0].created_at,
              }
            : undefined,
        };
      });

      // Filter by combined status if needed
      let filteredOwned = ownedWithType;
      if (params.status !== 'all') {
        filteredOwned = ownedWithType.filter((track: any) => track.status === params.status);
      }

      tracks.push(...filteredOwned);
    }

    // Fetch purchased tracks
    if (params.ownership === 'all' || params.ownership === 'purchased') {
      const { data: purchasedRows, error: purchasedError } = await supabase
        .from('track_access')
        .select(`
          track_id,
          access_type,
          granted_at,
          tracks!inner (
            ${TRACK_FIELDS_BASE}
          )
        `)
        .eq('user_id', user.id)
        .eq('access_type', 'purchase');

      if (purchasedError) {
        console.error('Error fetching purchased tracks:', purchasedError);
      } else {
        let purchasedTracks = (purchasedRows || [])
          .map((row: any) => {
            if (!row.tracks) return null;
            const track = row.tracks;

            return {
              ...track,
              duration: track.duration_seconds || 0,
              ownership: 'purchased' as const,
              purchasedAt: row.granted_at,
              renderStatus: undefined,
            };
          })
          .filter(Boolean) as any[];

        if (params.status !== 'all') {
          purchasedTracks = purchasedTracks.filter(track => track.status === params.status);
        }

        if (params.search) {
          const searchTerm = params.search.toLowerCase();
          purchasedTracks = purchasedTracks.filter(
            track =>
              track.title?.toLowerCase().includes(searchTerm) ||
              track.description?.toLowerCase().includes(searchTerm)
          );
        }

        if (params.tags) {
          const tagList = params.tags.split(',').map(t => t.trim().toLowerCase());
          purchasedTracks = purchasedTracks.filter((track: any) => {
            if (!Array.isArray(track.tags)) return false;
            const trackTags = track.tags.map((tag: string) => tag.toLowerCase());
            return tagList.every(tag => trackTags.includes(tag));
          });
        }

        purchasedTracks.forEach(track => {
          if (!tracks.find(existing => existing.id === track.id)) {
            tracks.push(track);
          }
        });
      }
    }

    // Sort combined results if needed
    if (params.ownership === 'all') {
      tracks.sort((a, b) => {
        const aValue = a[params.sort] || '';
        const bValue = b[params.sort] || '';
        
        if (params.order === 'asc') {
          return aValue > bValue ? 1 : -1;
        }
        return aValue < bValue ? 1 : -1;
      });
    }

    // Apply pagination
    const startIndex = (params.page - 1) * params.limit;
    const endIndex = startIndex + params.limit;
    const paginatedTracks = tracks.slice(startIndex, endIndex);

    // Generate signed URLs for tracks with audio files
    const tracksWithSignedUrls = await Promise.all(
      paginatedTracks.map(async (track) => {
        if (track.audio_url) {
          const { signedUrl } = await generateSignedUrl(track.audio_url, 3600, supabase); // 1 hour for playback
          return {
            ...track,
            audio_signed_url: signedUrl,
          };
        }
        return track;
      })
    );

    return NextResponse.json({
      tracks: tracksWithSignedUrls,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: tracks.length,
        totalPages: Math.ceil(tracks.length / params.limit),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/library/tracks:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
