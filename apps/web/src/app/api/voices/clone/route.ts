/**
 * Voice Cloning API Routes
 * Handles voice cloning operations with ElevenLabs
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@mindscript/auth/server";
import { ElevenLabsVoiceCloning } from "@mindscript/audio-engine/providers/ElevenLabsCloning";
import {
  voiceCloneRequestSchema,
  voiceConsentSchema,
  voiceUploadSchema,
  SUBSCRIPTION_LIMITS,
  type VoiceCloneRequest,
} from "@mindscript/schemas";
import { z } from "zod";

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
 * POST /api/voices/clone
 * Clone a voice from an audio sample
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient(request);
    const serviceSupabase = createServiceRoleClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's subscription tier
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const subscriptionTier = profile.subscription_tier || "free";
    const limits = SUBSCRIPTION_LIMITS[subscriptionTier];

    // Check if user can create custom voices
    if (!limits.allowCustomVoices) {
      return NextResponse.json(
        { error: "Custom voices not available for your subscription tier" },
        { status: 403 }
      );
    }

    // Check current voice count
    const { data: voiceCount, error: countError } = await supabase
      .from("cloned_voices")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .in("status", ["pending", "processing", "active"])
      .is("deleted_at", null);

    const currentVoiceCount = Array.isArray(voiceCount) ? voiceCount.length : 0;

    if (currentVoiceCount >= limits.maxVoices) {
      return NextResponse.json(
        { error: `Voice limit reached. Your ${subscriptionTier} subscription allows ${limits.maxVoices} voice(s).` },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const description = formData.get("description") as string | null;
    const audioFile = formData.get("audio") as File | null;
    const consentJson = formData.get("consent") as string;
    const uploadDataJson = formData.get("uploadData") as string;
    const labelsJson = formData.get("labels") as string | null;

    if (!name || !audioFile || !consentJson || !uploadDataJson) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Parse and validate consent
    let consent;
    try {
      consent = JSON.parse(consentJson);
      const consentValidation = voiceConsentSchema.safeParse(consent);
      if (!consentValidation.success) {
        return NextResponse.json(
          { error: consentValidation.error.issues[0].message },
          { status: 400 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid consent data" },
        { status: 400 }
      );
    }

    // Parse and validate upload data
    let uploadData;
    try {
      uploadData = JSON.parse(uploadDataJson);
      const uploadValidation = voiceUploadSchema.safeParse(uploadData);
      if (!uploadValidation.success) {
        return NextResponse.json(
          { error: uploadValidation.error.issues[0].message },
          { status: 400 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid upload data" },
        { status: 400 }
      );
    }

    // Check file size limits
    if (audioFile.size > limits.maxUploadSize) {
      return NextResponse.json(
        { error: `File size exceeds limit of ${limits.maxUploadSize / 1048576}MB for your subscription` },
        { status: 400 }
      );
    }

    // Check duration limits
    if (uploadData.duration > limits.maxDuration) {
      return NextResponse.json(
        { error: `Audio duration exceeds limit of ${limits.maxDuration} seconds for your subscription` },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    // Upload audio sample to Supabase Storage
    const fileName = `${user.id}/${Date.now()}-${audioFile.name}`;
    const { data: uploadResult, error: uploadError } = await serviceSupabase.storage
      .from("voice-samples")
      .upload(fileName, audioBuffer, {
        contentType: audioFile.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "Failed to upload audio sample" },
        { status: 500 }
      );
    }

    // Get signed URL for the uploaded file (valid for 1 year)
    const { data: urlData, error: urlError } = await serviceSupabase.storage
      .from("voice-samples")
      .createSignedUrl(fileName, 31536000); // 1 year

    if (urlError || !urlData) {
      return NextResponse.json(
        { error: "Failed to generate sample URL" },
        { status: 500 }
      );
    }

    // Create voice record in database (pending status)
    const { data: voiceRecord, error: dbError } = await serviceSupabase
      .from("cloned_voices")
      .insert({
        user_id: user.id,
        voice_id: "pending", // Will be updated after cloning
        voice_name: name,
        description,
        sample_file_url: urlData.signedUrl,
        sample_file_size: audioFile.size,
        sample_duration: uploadData.duration,
        labels: labelsJson ? JSON.parse(labelsJson) : {},
        status: "processing",
        monthly_usage_limit: limits.monthlyUsageLimit,
      })
      .select()
      .single();

    if (dbError || !voiceRecord) {
      // Clean up uploaded file
      await serviceSupabase.storage.from("voice-samples").remove([fileName]);
      return NextResponse.json(
        { error: "Failed to create voice record" },
        { status: 500 }
      );
    }

    // Store consent record
    const { error: consentError } = await serviceSupabase
      .from("voice_consent_records")
      .insert({
        voice_id: voiceRecord.id,
        user_id: user.id,
        ...consent,
        consent_text: "User consented to voice cloning terms and conditions v1.0",
        consent_version: "1.0",
      });

    if (consentError) {
      // Clean up on failure
      await serviceSupabase.from("cloned_voices").delete().eq("id", voiceRecord.id);
      await serviceSupabase.storage.from("voice-samples").remove([fileName]);
      return NextResponse.json(
        { error: "Failed to store consent record" },
        { status: 500 }
      );
    }

    // Initialize ElevenLabs client
    const elevenLabs = new ElevenLabsVoiceCloning();

    // Prepare clone request
    const cloneRequest: VoiceCloneRequest = {
      name,
      description: description || undefined,
      uploadData,
      consent,
      labels: labelsJson ? JSON.parse(labelsJson) : undefined,
    };

    // Clone the voice
    const cloneResult = await elevenLabs.cloneVoice(cloneRequest, audioBuffer);

    if (!cloneResult.isOk) {
      // Update record with failure
      await serviceSupabase
        .from("cloned_voices")
        .update({
          status: "failed",
          error_message: (cloneResult as any).error?.message,
        })
        .eq("id", voiceRecord.id);

      return NextResponse.json(
        { error: "Failed to clone voice: " + (cloneResult as any).error?.message },
        { status: 500 }
      );
    }

    if (!cloneResult.value.success || !cloneResult.value.voiceId) {
      // Update record with failure
      await serviceSupabase
        .from("cloned_voices")
        .update({
          status: "failed",
          error_message: cloneResult.value.error || "Unknown error",
        })
        .eq("id", voiceRecord.id);

      return NextResponse.json(
        { error: cloneResult.value.error || "Voice cloning failed" },
        { status: 500 }
      );
    }

    // Update voice record with ElevenLabs voice ID
    const { data: updatedVoice, error: updateError } = await serviceSupabase
      .from("cloned_voices")
      .update({
        voice_id: cloneResult.value.voiceId,
        status: "active",
      })
      .eq("id", voiceRecord.id)
      .select()
      .single();

    if (updateError) {
      // Try to delete the voice from ElevenLabs
      await elevenLabs.deleteVoice(cloneResult.value.voiceId);
      return NextResponse.json(
        { error: "Failed to activate voice" },
        { status: 500 }
      );
    }

    // Log audit event
    await serviceSupabase.from("audit_logs").insert({
      user_id: user.id,
      action: "voice_cloned",
      table_name: "cloned_voices",
      record_id: voiceRecord.id,
      new_data: { voice_id: cloneResult.value.voiceId },
      metadata: { subscription_tier: subscriptionTier },
    });

    return NextResponse.json({
      success: true,
      voice: updatedVoice,
      message: "Voice cloned successfully",
    });
  } catch (error) {
    console.error("Voice cloning error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/voices/clone
 * Delete a cloned voice (GDPR compliant)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseClient(request);
    const serviceSupabase = createServiceRoleClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get voice ID from query params
    const { searchParams } = new URL(request.url);
    const voiceId = searchParams.get("voiceId");

    if (!voiceId) {
      return NextResponse.json(
        { error: "Voice ID required" },
        { status: 400 }
      );
    }

    // Get voice record
    const { data: voice, error: voiceError } = await supabase
      .from("cloned_voices")
      .select("*")
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
        { error: "You don't have permission to delete this voice" },
        { status: 403 }
      );
    }

    // Delete from ElevenLabs if voice was successfully created
    if (voice.status === "active" && voice.voice_id !== "pending") {
      const elevenLabs = new ElevenLabsVoiceCloning();
      const deleteResult = await elevenLabs.deleteVoice(voice.voice_id);

      if (!deleteResult.isOk) {
        console.error("Failed to delete from ElevenLabs:", (deleteResult as any).error);
        // Continue with soft delete even if ElevenLabs deletion fails
      }
    }

    // Delete audio sample from storage if exists
    if (voice.sample_file_url) {
      const urlParts = voice.sample_file_url.split("/");
      const fileName = urlParts.slice(-2).join("/"); // Get user_id/filename

      const { error: storageError } = await serviceSupabase.storage
        .from("voice-samples")
        .remove([fileName]);

      if (storageError) {
        console.error("Failed to delete sample from storage:", storageError);
        // Continue with soft delete
      }
    }

    // Soft delete the voice record (GDPR compliant)
    const { error: deleteError } = await serviceSupabase
      .from("cloned_voices")
      .update({
        status: "deleted",
        deleted_at: new Date().toISOString(),
        voice_id: "DELETED", // Clear sensitive data
        sample_file_url: null,
        metadata: {},
      })
      .eq("id", voiceId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete voice" },
        { status: 500 }
      );
    }

    // Log audit event
    await serviceSupabase.from("audit_logs").insert({
      user_id: user.id,
      action: "voice_deleted",
      table_name: "cloned_voices",
      record_id: voiceId,
      metadata: { reason: "User requested deletion" },
    });

    return NextResponse.json({
      success: true,
      message: "Voice deleted successfully",
    });
  } catch (error) {
    console.error("Voice deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/voices/clone
 * Get user's cloned voices
 */
export async function GET(request: NextRequest) {
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

    // Get user's voices
    const { data: voices, error: voicesError } = await supabase
      .from("cloned_voices")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (voicesError) {
      return NextResponse.json(
        { error: "Failed to fetch voices" },
        { status: 500 }
      );
    }

    // Get user's subscription tier for limits
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();

    const subscriptionTier = profile?.subscription_tier || "free";
    const limits = SUBSCRIPTION_LIMITS[subscriptionTier];

    return NextResponse.json({
      success: true,
      voices: voices || [],
      limits: {
        maxVoices: limits.maxVoices,
        currentCount: voices?.length || 0,
        canAddMore: (voices?.length || 0) < limits.maxVoices,
      },
    });
  } catch (error) {
    console.error("Get voices error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}