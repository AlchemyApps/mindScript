import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/catalog/upload - Upload audio files
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Check admin auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File
    const metadata = formData.get('metadata') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only audio files are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      )
    }

    // Generate unique file name
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}_${safeName}`
    const filePath = `catalog/${fileName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('background-music')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      throw uploadError
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('background-music')
      .getPublicUrl(filePath)

    // Parse metadata if provided
    let parsedMetadata: Record<string, any> = {}
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata)
      } catch (e) {
        console.error('Failed to parse metadata:', e)
      }
    }

    // Create track record in database
    const { data: track, error: dbError } = await supabase
      .from('background_tracks')
      .insert({
        title: parsedMetadata['title'] || file.name.replace(/\.[^/.]+$/, ''),
        artist: parsedMetadata['artist'] || null,
        url: publicUrl,
        price_cents: parsedMetadata['price_cents'] || 100,
        is_platform_asset: true,
        is_stereo: true,
        file_size_bytes: file.size,
        file_format: file.type,
        tags: parsedMetadata['tags'] || [],
        category: parsedMetadata['category'] || null,
        mood: parsedMetadata['mood'] || null,
        genre: parsedMetadata['genre'] || null,
        metadata: parsedMetadata,
        created_by: user.id
      })
      .select()
      .single()

    if (dbError) {
      // Try to clean up the uploaded file if DB insert fails
      await supabase.storage.from('background-music').remove([filePath])
      throw dbError
    }

    return NextResponse.json({
      track,
      upload: {
        fileName,
        filePath,
        publicUrl,
        size: file.size
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/catalog/upload/bulk - Handle bulk upload batch creation
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Check admin auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const body = await req.json()
    const { batchName, files } = body

    if (!batchName || !files || !Array.isArray(files)) {
      return NextResponse.json(
        { error: 'Invalid batch data' },
        { status: 400 }
      )
    }

    // Create batch record
    const { data: batch, error: batchError } = await supabase
      .from('catalog_upload_batch')
      .insert({
        batch_name: batchName,
        uploaded_by: user.id,
        total_files: files.length,
        status: 'pending',
        metadata: { files }
      })
      .select()
      .single()

    if (batchError) throw batchError

    // Create individual upload items
    const uploadItems = files.map(file => ({
      batch_id: batch.id,
      file_name: file.name,
      file_size_bytes: file.size || null,
      status: 'pending'
    }))

    const { error: itemsError } = await supabase
      .from('catalog_upload_items')
      .insert(uploadItems)

    if (itemsError) throw itemsError

    return NextResponse.json({
      batch,
      message: `Batch created with ${files.length} files`
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating batch:', error)
    return NextResponse.json(
      { error: 'Failed to create batch', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}