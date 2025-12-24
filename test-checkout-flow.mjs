#!/usr/bin/env node

/**
 * Manual test script for checkout flow
 * Tests the builder → checkout → webhook → render flow
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://byzhzzmdorxamtnrmntp.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🧪 Testing Checkout Metadata Flow\n');
console.log('=====================================\n');

// Step 1: Simulate checkout request payload
const checkoutPayload = {
  userId: 'test-user-123',
  builderState: {
    script: 'This is a test meditation script for testing the checkout flow.',
    voice: {
      provider: 'openai',
      voice_id: 'alloy',
      settings: {
        speed: 1.0
      }
    },
    music: {
      id: 'music-test-123',
      volume_db: -20
    },
    solfeggio: {
      enabled: true,
      frequency: 528,
      volume_db: -20
    },
    binaural: {
      enabled: true,
      band: 'theta',
      volume_db: -20
    }
  },
  successUrl: `http://localhost:3001/library?new=true&session={CHECKOUT_SESSION_ID}`,
  cancelUrl: 'http://localhost:3001/builder',
  priceAmount: 397, // $3.97
  firstTrackDiscount: true
};

console.log('📋 Test Payload:');
console.log('- User ID:', checkoutPayload.userId);
console.log('- Script length:', checkoutPayload.builderState.script.length, 'chars');
console.log('- Voice:', checkoutPayload.builderState.voice.provider, '/', checkoutPayload.builderState.voice.voice_id);
console.log('- Add-ons:', [
  checkoutPayload.builderState.music ? '✓ Background Music' : '',
  checkoutPayload.builderState.solfeggio?.enabled ? '✓ Solfeggio (528 Hz)' : '',
  checkoutPayload.builderState.binaural?.enabled ? '✓ Binaural (theta)' : ''
].filter(Boolean).join(', '));
console.log('- Price:', `$${(checkoutPayload.priceAmount / 100).toFixed(2)}`);
console.log('- First track discount:', checkoutPayload.firstTrackDiscount);
console.log('\n');

// Step 2: Test checkout endpoint
console.log('🔄 Testing /api/checkout/guest-conversion endpoint...\n');

try {
  const response = await fetch('http://localhost:3001/api/checkout/guest-conversion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(checkoutPayload)
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Checkout failed:', error);
    process.exit(1);
  }

  const { sessionId, url, expiresAt } = await response.json();
  console.log('✅ Checkout session created:');
  console.log('- Session ID:', sessionId);
  console.log('- Checkout URL:', url);
  console.log('- Expires at:', expiresAt);
  console.log('\n');

  // Step 3: Simulate webhook metadata (what Stripe would send)
  console.log('📨 Simulated webhook metadata structure:');

  // This is what the webhook handler should receive
  const webhookMetadata = {
    user_id: checkoutPayload.userId,
    user_email: '',
    is_first_purchase: 'true',
    track_config: JSON.stringify({
      title: `Track - ${new Date().toLocaleDateString()}`,
      script: checkoutPayload.builderState.script,
      voice: {
        provider: checkoutPayload.builderState.voice.provider,
        voice_id: checkoutPayload.builderState.voice.voice_id,
        name: 'Alloy',  // Derived from voice_id
        settings: checkoutPayload.builderState.voice.settings || {}
      },
      duration: 10,  // Estimated from script
      backgroundMusic: checkoutPayload.builderState.music ? {
        id: checkoutPayload.builderState.music.id,
        name: 'Background Music',
        url: '',
        volume_db: checkoutPayload.builderState.music.volume_db || -20
      } : null,
      solfeggio: checkoutPayload.builderState.solfeggio,
      binaural: checkoutPayload.builderState.binaural
    })
  };

  console.log('Expected metadata keys:', Object.keys(webhookMetadata));
  console.log('track_config present:', !!webhookMetadata.track_config);
  console.log('track_config size:', webhookMetadata.track_config.length, 'chars');
  console.log('\n');

  // Step 4: Log IDs for verification
  console.log('📊 Verification IDs to check in Supabase:');
  console.log('- Session ID:', sessionId);
  console.log('- User ID:', checkoutPayload.userId);
  console.log('\n');

  console.log('🎯 Next Steps:');
  console.log('1. Open the Stripe checkout URL in test mode');
  console.log('2. Complete payment with test card 4242 4242 4242 4242');
  console.log('3. Check webhook logs for metadata parsing');
  console.log('4. Verify in Supabase:');
  console.log('   - purchases table for new record');
  console.log('   - tracks table for track with config');
  console.log('   - audio_job_queue for render job');
  console.log('\n');

  console.log('Checkout URL:');
  console.log(url);
  console.log('\n');

} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}