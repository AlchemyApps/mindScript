import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const stripeMocks = vi.hoisted(() => ({
  sessionCreate: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => {
  const insertSingle = vi.fn().mockResolvedValue({ data: { id: 'pending-track-id' }, error: null });
  const selectSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const baseChain = {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: insertSingle,
      })),
    })),
    select: vi.fn(() => ({
      single: selectSingle,
    })),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn(() => ({
      eq: vi.fn().mockReturnThis(),
    })),
    eq: vi.fn().mockReturnThis(),
    single: selectSingle,
  };

  return {
    client: {
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({ data: { user: { email: 'test@example.com' } }, error: null }),
        },
      },
      from: vi.fn(() => baseChain),
    },
  };
});

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn(() => ({
      checkout: {
        sessions: {
          create: stripeMocks.sessionCreate
        }
      }
    }))
  };
});

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => supabaseMocks.client),
  };
});

const mockStripeSessionCreate = stripeMocks.sessionCreate;

import { POST } from './route';

describe('POST /api/checkout/guest-conversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeSessionCreate.mockClear();
  });

  it('should create checkout session with track_config in metadata for small configs', async () => {
    const requestData = {
      userId: 'user123',
      builderState: {
        title: 'Calm Morning Reset',
        script: 'This is a short meditation script.',
        voice: {
          provider: 'openai',
          voice_id: 'alloy',
          name: 'Alloy'
        },
        music: {
          id: 'music123',
          name: 'Calm Ocean',
          price: 0.99,
          volume_db: -10
        },
        solfeggio: {
          enabled: true,
          frequency: 528,
          price: 0.49,
          volume_db: -16
        },
        binaural: {
          enabled: true,
          band: 'theta',
          price: 0.49,
          volume_db: -18
        },
        loop: {
          enabled: true,
          pause_seconds: 5
        },
        duration: 10
      },
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      priceAmount: 397, // $3.97 in cents
      firstTrackDiscount: true
    };

    // Mock successful session creation
    mockStripeSessionCreate.mockResolvedValueOnce({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/session123',
      expires_at: Math.floor(Date.now() / 1000) + 1800
    });

    const request = new NextRequest('http://localhost:3000/api/checkout/guest-conversion', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });

    const response = await POST(request);
    const data = await response.json();

    // Check response
    expect(response.status).toBe(200);
    expect(data.sessionId).toBe('cs_test_123');
    expect(data.url).toBe('https://checkout.stripe.com/session123');

    // Check Stripe was called with correct metadata
    expect(mockStripeSessionCreate).toHaveBeenCalledOnce();
    const callArgs = mockStripeSessionCreate.mock.calls[0][0];

    expect(callArgs.metadata.user_id).toBe('user123');
    expect(callArgs.metadata.is_first_purchase).toBe('true');
    expect(callArgs.metadata.track_config).toBeDefined();

    // Parse and verify track_config
    const trackConfig = JSON.parse(callArgs.metadata.track_config);
    expect(trackConfig.script).toBe('This is a short meditation script.');
    expect(trackConfig.title).toBe('Calm Morning Reset');
    expect(trackConfig.voice.provider).toBe('openai');
    expect(trackConfig.voice.voice_id).toBe('alloy');
    expect(trackConfig.backgroundMusic.id).toBe('music123');
    expect(trackConfig.solfeggio.frequency).toBe(528);
    expect(trackConfig.binaural.band).toBe('theta');
    expect(trackConfig.loop.enabled).toBe(true);
  });

  it('should chunk large scripts and use track_config_partial', async () => {
    // Create a script larger than 500 chars to trigger chunking
    const longScript = 'This is a very long meditation script. '.repeat(50); // ~2000 chars

    const requestData = {
      userId: 'user456',
      builderState: {
        title: 'Long Focus Session',
        script: longScript,
        voice: {
          provider: 'elevenlabs',
          voice_id: 'voice123',
          name: 'Sarah'
        },
        duration: 15,
        backgroundMusic: undefined,
        solfeggio: undefined,
        binaural: undefined,
        loop: {
          enabled: true,
          pause_seconds: 5
        }
      },
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      priceAmount: 99, // $0.99 in cents
      firstTrackDiscount: true
    };

    mockStripeSessionCreate.mockResolvedValueOnce({
      id: 'cs_test_456',
      url: 'https://checkout.stripe.com/session456',
      expires_at: Math.floor(Date.now() / 1000) + 1800
    });

    const request = new NextRequest('http://localhost:3000/api/checkout/guest-conversion', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    // Check metadata has chunked script
    const callArgs = mockStripeSessionCreate.mock.calls[0][0];

    expect(callArgs.metadata.track_config).toBeUndefined();
    expect(callArgs.metadata.track_config_partial).toBeDefined();

    // Parse partial config
    const partialConfig = JSON.parse(callArgs.metadata.track_config_partial);
    expect(partialConfig.script).toBe(''); // Script removed from partial
    expect(partialConfig.voice.provider).toBe('elevenlabs');

    // Check script chunks exist
    expect(callArgs.metadata.script_chunks_count).toBeDefined();
    const chunksCount = parseInt(callArgs.metadata.script_chunks_count);
    expect(chunksCount).toBeGreaterThan(0);

    // Verify first chunk exists
    expect(callArgs.metadata.script_chunk_0).toBeDefined();
    expect(callArgs.metadata.script_chunk_0.length).toBeLessThanOrEqual(400);

    // Reconstruct script from chunks to verify
    let reconstructedScript = '';
    for (let i = 0; i < chunksCount; i++) {
      reconstructedScript += callArgs.metadata[`script_chunk_${i}`] || '';
    }
    expect(reconstructedScript).toBe(longScript);
  });

  it('should handle email as userId', async () => {
    const requestData = {
      userId: 'user@example.com',
      builderState: {
        title: 'Quick Test Track',
        script: 'Test script',
        voice: {
          provider: 'openai',
          voice_id: 'alloy',
          name: 'Alloy'
        },
        duration: 5,
        loop: {
          enabled: true,
          pause_seconds: 5
        }
      },
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      priceAmount: 299,
      firstTrackDiscount: false
    };

    mockStripeSessionCreate.mockResolvedValueOnce({
      id: 'cs_test_789',
      url: 'https://checkout.stripe.com/session789',
      expires_at: Math.floor(Date.now() / 1000) + 1800
    });

    const request = new NextRequest('http://localhost:3000/api/checkout/guest-conversion', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const callArgs = mockStripeSessionCreate.mock.calls[0][0];
    expect(callArgs.metadata.user_id).toBe('user@example.com');
    expect(callArgs.metadata.user_email).toBe('user@example.com');
    expect(callArgs.metadata.is_first_purchase).toBe('false');
  });

  it('should return 400 for invalid request data', async () => {
    const invalidData = {
      // Missing required fields
      builderState: {}
    };

    const request = new NextRequest('http://localhost:3000/api/checkout/guest-conversion', {
      method: 'POST',
      body: JSON.stringify(invalidData)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request data');
    expect(data.details).toBeDefined();
  });
});
