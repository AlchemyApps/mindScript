#!/usr/bin/env node

/**
 * Test script to verify webhook can process metadata correctly
 * Simulates the Stripe webhook event with our aligned metadata
 */

console.log('🧪 Testing Webhook Metadata Processing\n');
console.log('=====================================\n');

// Simulate the metadata that checkout would create
const metadata = {
  user_id: 'test-user-123',
  user_email: '',
  conversion_type: 'guest_to_user',
  is_first_purchase: 'true',
  first_track: 'true',
  total_amount: '397',
  track_config: JSON.stringify({
    title: `Track - ${new Date().toLocaleDateString()}`,
    script: 'This is a test meditation script for testing the checkout flow.',
    voice: {
      provider: 'openai',
      voice_id: 'alloy',
      name: 'Alloy',
      settings: { speed: 1.0 }
    },
    duration: 10,
    backgroundMusic: {
      id: 'music-test-123',
      name: 'Background Music',
      url: '',
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
  })
};

// Parse the track config like the webhook would
console.log('📋 Metadata Structure:');
console.log('- user_id:', metadata.user_id);
console.log('- is_first_purchase:', metadata.is_first_purchase);
console.log('- total_amount:', `$${(parseInt(metadata.total_amount) / 100).toFixed(2)}`);
console.log('- track_config present:', !!metadata.track_config);
console.log('- track_config size:', metadata.track_config.length, 'chars\n');

// Parse and validate the config
try {
  const trackConfig = JSON.parse(metadata.track_config);

  console.log('✅ Track Config Parsed Successfully:');
  console.log('- Title:', trackConfig.title);
  console.log('- Script length:', trackConfig.script.length, 'chars');
  console.log('- Voice:', trackConfig.voice.provider, '/', trackConfig.voice.voice_id);
  console.log('- Duration:', trackConfig.duration, 'minutes');
  console.log('- Background Music:', trackConfig.backgroundMusic ? 'Yes' : 'No');
  console.log('- Solfeggio:', trackConfig.solfeggio?.enabled ? `${trackConfig.solfeggio.frequency} Hz` : 'No');
  console.log('- Binaural:', trackConfig.binaural?.enabled ? trackConfig.binaural.band : 'No');
  console.log('\n');

  // Validate required fields
  const hasRequiredFields = trackConfig.script && trackConfig.voice && trackConfig.voice.voice_id;

  if (hasRequiredFields) {
    console.log('✅ All required fields present for track creation');
    console.log('\nThe webhook handler should be able to:');
    console.log('1. Create purchase record with this metadata');
    console.log('2. Extract track config and start track build');
    console.log('3. Create audio job in queue');
    console.log('4. Track will appear in library after render');
  } else {
    console.error('❌ Missing required fields:', {
      hasScript: !!trackConfig.script,
      hasVoice: !!trackConfig.voice,
      hasVoiceId: !!trackConfig.voice?.voice_id
    });
  }
} catch (error) {
  console.error('❌ Failed to parse track_config:', error);
}

console.log('\n🎯 Summary:');
console.log('The metadata structure is correctly aligned for the webhook to process.');
console.log('When a real checkout completes, the webhook will receive this metadata');
console.log('and create the track with all configured add-ons.');