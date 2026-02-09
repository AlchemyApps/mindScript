/**
 * Voice Preview API Route
 * Generates preview audio for cloned voices
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ElevenLabsVoiceCloning } from "@mindscript/audio-engine/providers/ElevenLabsCloning";
import { voicePreviewRequestSchema } from "@mindscript/schemas";

// Initialize Supabase client
function getSupabaseClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: request.headers.get("Authorization") || "",
      },
    },
  });
}

/**
 * POST /api/voices/preview
 * Generate preview audio for a cloned voice
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient(request);

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate request
    const validation = voicePreviewRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { voiceId, text, stability, similarityBoost } = validation.data;

    // Get voice record to verify ownership and get ElevenLabs voice ID
    const { data: voice, error: voiceError } = await supabase
      .from("cloned_voices")
      .select("voice_id, user_id, status")
      .eq("id", voiceId)
      .single();

    if (voiceError || !voice) {
      return NextResponse.json(
        { error: "Voice not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (voice.user_id !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to preview this voice" },
        { status: 403 }
      );
    }

    // Check if voice is active
    if (voice.status !== "active") {
      return NextResponse.json(
        { error: "Voice is not active. Current status: " + voice.status },
        { status: 400 }
      );
    }

    // Initialize ElevenLabs client
    const elevenLabs = new ElevenLabsVoiceCloning();

    // Generate preview
    const previewResult = await elevenLabs.previewVoice(
      voice.voice_id,
      text
    );

    if (!previewResult.isOk) {
      return NextResponse.json(
        { error: "Failed to generate preview: " + (previewResult as any).error?.message },
        { status: 500 }
      );
    }

    // Convert Buffer to base64 for transmission
    const audioBase64 = previewResult.value.toString("base64");

    // Track usage (optional - for analytics)
    await supabase.from("voice_usage_logs").insert({
      voice_id: voiceId,
      user_id: user.id,
      characters_used: text.length,
      model_used: "eleven_monolingual_v1",
    });

    return NextResponse.json({
      success: true,
      audio: audioBase64,
      format: "mp3",
      charactersUsed: text.length,
    });
  } catch (error) {
    console.error("Voice preview error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}