import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@mindscript/auth/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

const supabaseAdmin = createServiceRoleClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trackId } = await params;

  try {
    // Authenticate
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership
    const { data: track, error: trackError } = await supabaseAdmin
      .from('tracks')
      .select('id, user_id')
      .eq('id', trackId)
      .eq('user_id', user.id)
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Parse multipart form
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' }, { status: 400 });
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
    const fileName = `${user.id}/${trackId}/${Date.now()}-cover.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from('track-artwork')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[ARTWORK] Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('track-artwork')
      .getPublicUrl(fileName);

    const publicUrl = urlData?.publicUrl || '';

    // Update track record
    const { error: updateError } = await supabaseAdmin
      .from('tracks')
      .update({ cover_image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', trackId);

    if (updateError) {
      console.error('[ARTWORK] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update track' }, { status: 500 });
    }

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('[ARTWORK] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trackId } = await params;

  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership and get current URL
    const { data: track, error: trackError } = await supabaseAdmin
      .from('tracks')
      .select('id, user_id, cover_image_url')
      .eq('id', trackId)
      .eq('user_id', user.id)
      .single();

    if (trackError || !track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Delete from storage if exists
    if (track.cover_image_url) {
      // Extract path from URL
      const url = new URL(track.cover_image_url);
      const storagePath = url.pathname.split('/track-artwork/')[1];
      if (storagePath) {
        await supabaseAdmin.storage
          .from('track-artwork')
          .remove([decodeURIComponent(storagePath)]);
      }
    }

    // Clear URL from track
    await supabaseAdmin
      .from('tracks')
      .update({ cover_image_url: null, updated_at: new Date().toISOString() })
      .eq('id', trackId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ARTWORK] Delete error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
