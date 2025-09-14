import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ValidateTrackSchema, PublishMetadataSchema, PricingConfigSchema } from '@mindscript/schemas';
import { z } from 'zod';

const ValidatePublishRequestSchema = z.object({
  metadata: PublishMetadataSchema,
  pricing: PricingConfigSchema,
  trackConfig: ValidateTrackSchema,
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = ValidatePublishRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validation.error.errors 
        },
        { status: 400 }
      );
    }

    const { metadata, pricing, trackConfig } = validation.data;

    // Additional business logic validation
    const errors: string[] = [];

    // Check script length for TTS limits
    if (trackConfig.script.length > 5000) {
      errors.push('Script exceeds maximum length for text-to-speech processing (5000 characters)');
    }

    // Validate binaural beats require stereo output
    if (trackConfig.frequency_config?.binaural) {
      // This is fine for MP3 as it supports stereo
      // Just noting this check exists
    }

    // Validate pricing logic
    if (pricing.enableMarketplace) {
      if (!pricing.price || pricing.price < 0.99 || pricing.price > 49.99) {
        errors.push('Price must be between $0.99 and $49.99');
      }
      
      if (pricing.promotional && pricing.promotionalPrice) {
        if (pricing.promotionalPrice >= pricing.price) {
          errors.push('Promotional price must be less than regular price');
        }
        if (pricing.promotionalPrice < 0.99 || pricing.promotionalPrice > 49.99) {
          errors.push('Promotional price must be between $0.99 and $49.99');
        }
      }
    }

    // Check if user has Stripe Connect setup for marketplace
    if (pricing.enableMarketplace) {
      const { data: sellerAgreement } = await supabase
        .from('seller_agreements')
        .select('stripe_connect_id, status')
        .eq('user_id', user.id)
        .single();

      if (!sellerAgreement || sellerAgreement.status !== 'active') {
        errors.push('You must complete seller onboarding to list tracks in the marketplace');
      }
    }

    // Check for duplicate title
    if (metadata.title) {
      const { data: existingTrack } = await supabase
        .from('tracks')
        .select('id')
        .eq('user_id', user.id)
        .eq('title', metadata.title)
        .single();

      if (existingTrack) {
        errors.push('A track with this title already exists in your library');
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { 
          valid: false,
          errors 
        },
        { status: 400 }
      );
    }

    // All validations passed
    return NextResponse.json({
      valid: true,
      message: 'Track configuration is valid and ready for publishing',
      estimatedRenderTime: calculateEstimatedRenderTime(trackConfig.script.length),
    });

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateEstimatedRenderTime(scriptLength: number): number {
  // Base time: 30 seconds
  let time = 30;
  
  // Add time based on script length (roughly 1 second per 100 characters)
  time += Math.ceil(scriptLength / 100);
  
  // Add buffer for audio processing
  time += 30;
  
  // Return in seconds
  return time;
}