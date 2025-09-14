import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

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
    
    // Fetch owned tracks
    if (params.ownership === 'all' || params.ownership === 'owned') {
      let ownedQuery = supabase
        .from('tracks')
        .select(`
          *,
          profiles!owner_id (display_name, avatar_url)
          ${params.includeRenderStatus ? ', audio_job_queue!track_id (id, status, progress, created_at, updated_at)' : ''}
        `)
        .eq('owner_id', user.id);

      // Apply status filter
      if (params.status !== 'all') {
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

      // Add ownership type
      const ownedWithType = (ownedTracks || []).map(track => ({
        ...track,
        ownership: 'owned' as const,
        renderStatus: params.includeRenderStatus && track.audio_job_queue?.[0] 
          ? {
              id: track.audio_job_queue[0].id,
              status: track.audio_job_queue[0].status,
              progress: track.audio_job_queue[0].progress,
              createdAt: track.audio_job_queue[0].created_at,
              updatedAt: track.audio_job_queue[0].updated_at,
            }
          : undefined,
      }));

      tracks.push(...ownedWithType);
    }

    // Fetch purchased tracks
    if (params.ownership === 'all' || params.ownership === 'purchased') {
      let purchasedQuery = supabase
        .from('track_access')
        .select(`
          track_id,
          granted_at,
          tracks!track_id (
            *,
            profiles!owner_id (display_name, avatar_url)
            ${params.includeRenderStatus ? ', audio_job_queue!track_id (id, status, progress, created_at, updated_at)' : ''}
          )
        `)
        .eq('user_id', user.id)
        .eq('access_type', 'purchased');

      // Apply status filter for purchased tracks
      if (params.status !== 'all') {
        purchasedQuery = purchasedQuery.eq('tracks.status', params.status);
      }

      // Apply search filter for purchased tracks
      if (params.search) {
        purchasedQuery = purchasedQuery.or(
          `tracks.title.ilike.%${params.search}%,tracks.description.ilike.%${params.search}%`
        );
      }

      // Apply tags filter for purchased tracks
      if (params.tags) {
        const tagList = params.tags.split(',').map(t => t.trim());
        purchasedQuery = purchasedQuery.contains('tracks.tags', tagList);
      }

      // Apply sorting for purchased tracks
      purchasedQuery = purchasedQuery.order('granted_at', { ascending: false });

      const { data: purchasedAccess, error: purchasedError } = await purchasedQuery;
      
      if (purchasedError) {
        console.error('Error fetching purchased tracks:', purchasedError);
        return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
      }

      // Format purchased tracks
      const purchasedWithType = (purchasedAccess || [])
        .filter(access => access.tracks)
        .map(access => ({
          ...access.tracks,
          ownership: 'purchased' as const,
          purchasedAt: access.granted_at,
          renderStatus: params.includeRenderStatus && access.tracks.audio_job_queue?.[0] 
            ? {
                id: access.tracks.audio_job_queue[0].id,
                status: access.tracks.audio_job_queue[0].status,
                progress: access.tracks.audio_job_queue[0].progress,
                createdAt: access.tracks.audio_job_queue[0].created_at,
                updatedAt: access.tracks.audio_job_queue[0].updated_at,
              }
            : undefined,
        }));

      tracks.push(...purchasedWithType);
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

    // Get last played information from localStorage (client-side only)
    // This would be handled on the client side

    return NextResponse.json({
      tracks: paginatedTracks,
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