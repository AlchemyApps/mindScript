import { Page, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Test environment configuration
export const TEST_CONFIG = {
  baseUrl: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  stripeTestKey: process.env.STRIPE_TEST_SECRET_KEY || '',
  testTimeout: 30000,
  renderTimeout: 120000, // 2 minutes for audio rendering
};

// Create Supabase client for test data setup
export function createTestSupabaseClient() {
  return createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseAnonKey);
}

// Wait for network idle
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}

// Wait for element and scroll into view
export async function waitAndClick(page: Page, selector: string, timeout = 10000) {
  const element = await page.waitForSelector(selector, { timeout, state: 'visible' });
  await element.scrollIntoViewIfNeeded();
  await element.click();
}

// Generate unique test data
export function generateTestData(prefix: string) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);

  return {
    email: `${prefix}.${timestamp}.${random}@test.com`,
    username: `${prefix}_${timestamp}_${random}`,
    trackTitle: `Test Track ${prefix} ${timestamp}`,
    scriptContent: `This is a test meditation script created at ${timestamp}. Take a deep breath and relax.`,
    timestamp,
    random,
  };
}

// Mock Stripe checkout session
export async function mockStripeCheckout(page: Page) {
  await page.route('**/api/stripe/create-checkout-session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: 'cs_test_mock_session',
        url: `${TEST_CONFIG.baseUrl}/checkout/success?session_id=cs_test_mock_session`,
      }),
    });
  });
}

// Mock audio rendering job
export async function mockAudioRender(page: Page, jobId: string) {
  // Mock the audio processor endpoint
  await page.route('**/functions/v1/audio-processor', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        job_id: jobId,
        message: 'Job processed successfully',
      }),
    });
  });

  // Simulate progress updates
  await page.evaluate((jobId) => {
    // Mock realtime subscription updates
    window.postMessage({
      type: 'AUDIO_RENDER_PROGRESS',
      jobId,
      progress: 100,
      status: 'completed',
    }, '*');
  }, jobId);
}

// Wait for toast notification
export async function waitForToast(page: Page, text: string, timeout = 5000) {
  const toast = await page.waitForSelector(`[role="alert"]:has-text("${text}")`, { timeout });
  return toast;
}

// Clean up test user data
export async function cleanupTestUser(email: string) {
  const supabase = createTestSupabaseClient();

  try {
    // Delete user's tracks
    await supabase
      .from('tracks')
      .delete()
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

    // Delete user account (if exists)
    // This would require admin access or service role key
    console.log(`Cleanup for user ${email} completed`);
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Verify element text content
export async function verifyTextContent(page: Page, selector: string, expectedText: string) {
  const element = await page.waitForSelector(selector);
  const text = await element.textContent();
  expect(text).toContain(expectedText);
}

// Upload test file
export async function uploadTestFile(page: Page, selector: string, fileName: string, content: string) {
  const buffer = Buffer.from(content);
  await page.setInputFiles(selector, {
    name: fileName,
    mimeType: 'audio/mpeg',
    buffer,
  });
}

// Wait for navigation with timeout
export async function navigateAndWait(page: Page, url: string, waitUntilState: 'load' | 'domcontentloaded' | 'networkidle' = 'networkidle') {
  await Promise.all([
    page.waitForNavigation({ waitUntil: waitUntilState }),
    page.goto(url),
  ]);
}

// Check if element is visible
export async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 1000, state: 'visible' });
    return true;
  } catch {
    return false;
  }
}

// Mock external API responses
export async function setupAPIMocks(page: Page) {
  // Mock OpenAI TTS
  await page.route('**/api.openai.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'audio/mpeg',
      body: Buffer.from('mock audio data'),
    });
  });

  // Mock ElevenLabs
  await page.route('**/api.elevenlabs.io/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'audio/mpeg',
      body: Buffer.from('mock audio data'),
    });
  });

  // Mock Stripe webhooks
  await page.route('**/api/webhooks/stripe', async (route) => {
    await route.fulfill({
      status: 200,
      body: 'OK',
    });
  });
}