import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Schema for creating a playlist
const createPlaylistSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  cover_image_url: z.string().url().optional(),
  is_public: z.boolean().optional().default(false),
});

// Schema for updating a playlist
const updatePlaylistSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  cover_image_url: z.string().url().optional(),
  is_public: z.boolean().optional(),
});

// GET /api/library/playlists - Get user's playlists
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const includeTracks = searchParams.get('includeTracks') === 'true';
    const includePublic = searchParams.get('includePublic') === 'true';

    // Build query
    let query = supabase
      .from('playlists')
      .select(
        includeTracks
          ? `
            *,
            playlist_tracks (
              position,
              tracks (
                id,
                title,
                description,
                duration,
                audio_file_url,
                cover_image_url,
                status,
                profiles!owner_id (display_name, avatar_url)
              )
            )
          `
          : `
            *,
            track_count:playlist_tracks(count)
          `
      );

    // Filter by user or public playlists
    if (includePublic) {
      query = query.or(`user_id.eq.${user.id},is_public.eq.true`);
    } else {
      query = query.eq('user_id', user.id);
    }

    // Order by updated_at descending
    query = query.order('updated_at', { ascending: false });

    const { data: playlists, error } = await query;

    if (error) {
      console.error('Error fetching playlists:', error);
      return NextResponse.json({ error: 'Failed to fetch playlists' }, { status: 500 });
    }

    // Format response
    const formattedPlaylists = playlists?.map(playlist => {
      if (includeTracks && playlist.playlist_tracks) {
        // Sort tracks by position and extract track data
        const tracks = playlist.playlist_tracks
          .sort((a: any, b: any) => a.position - b.position)
          .map((pt: any) => pt.tracks)
          .filter(Boolean);
        
        return {
          ...playlist,
          tracks,
          track_count: tracks.length,
          playlist_tracks: undefined, // Remove intermediate data
        };
      }
      
      // Extract count from aggregate
      if (playlist.track_count && Array.isArray(playlist.track_count)) {
        return {
          ...playlist,
          track_count: playlist.track_count[0]?.count || 0,
        };
      }
      
      return playlist;
    });

    return NextResponse.json({ playlists: formattedPlaylists || [] });
  } catch (error) {
    console.error('Error in GET /api/library/playlists:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/library/playlists - Create a new playlist
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createPlaylistSchema.parse(body);

    // Create playlist
    const { data: playlist, error } = await supabase
      .from('playlists')
      .insert({
        ...validatedData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating playlist:', error);
      
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A playlist with this name already exists' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create playlist' },
        { status: 500 }
      );
    }

    return NextResponse.json({ playlist }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/library/playlists:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/library/playlists - Update a playlist
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updatePlaylistSchema.parse(body);

    const { id, ...updates } = validatedData;

    // Update playlist (RLS will ensure user owns it)
    const { data: playlist, error } = await supabase
      .from('playlists')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating playlist:', error);
      return NextResponse.json(
        { error: 'Failed to update playlist' },
        { status: 500 }
      );
    }

    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ playlist });
  } catch (error) {
    console.error('Error in PUT /api/library/playlists:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/library/playlists - Delete a playlist
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const playlistId = searchParams.get('id');

    if (!playlistId) {
      return NextResponse.json(
        { error: 'Playlist ID is required' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(playlistId)) {
      return NextResponse.json(
        { error: 'Invalid playlist ID format' },
        { status: 400 }
      );
    }

    // Delete playlist (cascade will remove playlist_tracks)
    const { data: deletedPlaylist, error } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlistId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error deleting playlist:', error);
      return NextResponse.json(
        { error: 'Failed to delete playlist' },
        { status: 500 }
      );
    }

    if (!deletedPlaylist) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      message: 'Playlist deleted successfully',
      playlist: deletedPlaylist 
    });
  } catch (error) {
    console.error('Error in DELETE /api/library/playlists:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}