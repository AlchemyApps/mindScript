#!/usr/bin/env node

/**
 * Manually trigger webhook to test track creation
 * Simulates what Stripe would send after checkout completion
 */

import crypto from 'crypto';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_CvFBawnQ0GpKadlcREoFfVoCna3VKU2E';
const WEBHOOK_URL = 'http://localhost:3001/api/webhooks/stripe';

console.log('🔄 Manually triggering webhook for checkout completion...\n');

// Get session ID from command line or use a test one
const sessionId = process.argv[2] || 'cs_test_manual_' + Date.now();
console.log('Session ID:', sessionId);

// Create a realistic webhook payload
const event = {
  id: 'evt_test_' + Date.now(),
  object: 'event',
  type: 'checkout.session.completed',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: sessionId,
      object: 'checkout.session',
      amount_total: 397, // $3.97
      currency: 'usd',
      customer: 'cus_test_123',
      customer_email: 'test@example.com',
      payment_intent: 'pi_test_' + Date.now(),
      payment_status: 'paid',
      status: 'complete',
      metadata: {
        user_id: 'dbb3e9f2-b901-4f0f-b4d1-83bf96b90c63', // Your actual user ID from auth
        user_email: '',
        conversion_type: 'guest_to_user',
        is_first_purchase: 'true',
        first_track: 'true',
        total_amount: '397',
        track_config: JSON.stringify({
          title: `Track - ${new Date().toLocaleDateString()}`,
          script: 'Welcome to your meditation journey. Take a deep breath and relax. This is a test meditation script that will help you unwind and find peace.',
          voice: {
            provider: 'openai',
            voice_id: 'alloy',
            name: 'Alloy',
            settings: { speed: 1.0 }
          },
          duration: 10,
          backgroundMusic: {
            id: 'music-calm-ocean',
            name: 'Calm Ocean',
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
      },
      success_url: 'http://localhost:3001/library?new=true',
      cancel_url: 'http://localhost:3001/builder'
    }
  }
};

// Create the webhook signature
const payload = JSON.stringify(event);
const timestamp = Math.floor(Date.now() / 1000);
const signedPayload = `${timestamp}.${payload}`;
const expectedSignature = crypto
  .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
  .update(signedPayload, 'utf8')
  .digest('hex');

const signature = `t=${timestamp},v1=${expectedSignature}`;

console.log('📦 Webhook payload prepared');
console.log('- Event type:', event.type);
console.log('- Customer email:', event.data.object.customer_email);
console.log('- Amount:', `$${event.data.object.amount_total / 100}`);
console.log('- Track config size:', event.data.object.metadata.track_config.length, 'chars\n');

// Send the webhook
console.log('📮 Sending webhook to:', WEBHOOK_URL);

try {
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature
    },
    body: payload
  });

  const result = await response.text();

  console.log('\n📨 Webhook response:');
  console.log('- Status:', response.status);
  console.log('- Body:', result);

  if (response.ok) {
    console.log('\n✅ Webhook processed successfully!');
    console.log('\n🎯 Next steps:');
    console.log('1. Check server logs for track creation');
    console.log('2. Check Supabase purchases table');
    console.log('3. Check Supabase tracks table');
    console.log('4. Check Supabase audio_job_queue table');
    console.log('5. Visit http://localhost:3001/library to see the track');
  } else {
    console.error('\n❌ Webhook failed with status:', response.status);
  }
} catch (error) {
  console.error('\n❌ Failed to send webhook:', error);
}