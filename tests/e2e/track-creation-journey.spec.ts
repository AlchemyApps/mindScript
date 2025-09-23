import { test, expect } from './fixtures/test-fixtures';
import { LibraryPage } from './pages/LibraryPage';
import {
  generateTestData,
  mockAudioRender,
  setupAPIMocks,
  waitForToast,
  cleanupTestUser,
} from './utils/test-helpers';
import { testDataSeeder } from './utils/test-data-seeder';

test.describe('Track Creation Journey', () => {
  let libraryPage: LibraryPage;
  let testData: ReturnType<typeof generateTestData>;
  let testUserId: string;

  test.beforeEach(async ({ page, loginPage, testUser }) => {
    // Set up API mocks
    await setupAPIMocks(page);

    // Generate test data
    testData = generateTestData('track-create');

    // Create and login test user
    const user = await testDataSeeder.createTestUser({
      email: testUser.email,
      password: testUser.password,
      profile: { display_name: testUser.name },
    });
    testUserId = user.id;

    // Login
    await loginPage.navigate();
    await loginPage.login(testUser.email, testUser.password);

    // Initialize page objects
    libraryPage = new LibraryPage(page);
  });

  test.afterEach(async () => {
    // Clean up test data
    if (testUserId) {
      await testDataSeeder.cleanup(testUserId);
    }
  });

  test('User creates first track from scratch', async ({ page, builderPage }) => {
    // Navigate to library
    await libraryPage.navigate();

    // Verify empty state
    const emptyState = await page.locator('text=/no tracks yet/i');
    await expect(emptyState).toBeVisible();

    // Click create track
    await libraryPage.navigateToBuilder();

    // Fill in track details
    await builderPage.fillScriptContent(testData.scriptContent);
    await builderPage.selectVoice('alloy');

    // Add background music (optional)
    await builderPage.toggleBackgroundMusic();
    await builderPage.selectBackgroundTrack('Peaceful Morning');
    await builderPage.setBackgroundVolume(-20);

    // Preview the track
    await builderPage.clickPreview();
    await expect(page.locator('[data-testid="preview-player"]')).toBeVisible();

    // Publish track
    await builderPage.clickPublish();

    // Fill metadata
    await page.fill('input[name="title"]', testData.trackTitle);
    await page.fill('textarea[name="description"]', 'My first meditation track');
    await page.selectOption('select[name="category"]', 'meditation');

    // Set visibility
    await page.click('input[value="private"]');

    // Submit
    await page.click('button:has-text("Publish Track")');

    // Mock the render process
    const jobId = `job-${testData.timestamp}`;
    await mockAudioRender(page, jobId);

    // Wait for success message
    await waitForToast(page, 'Track submitted for rendering');

    // Verify render progress appears
    await expect(page.locator('[data-testid="render-progress"]')).toBeVisible();

    // Wait for completion (mocked)
    await page.waitForTimeout(2000);

    // Should redirect to library
    await page.waitForURL('**/library');

    // Verify track appears in library
    const trackCard = await libraryPage.getTrackCard(testData.trackTitle);
    await expect(trackCard).toBeVisible();

    // Verify track status
    await libraryPage.verifyTrackStatus(testData.trackTitle, 'Published');
  });

  test('User creates track with advanced audio features', async ({ page, builderPage }) => {
    await page.goto('/builder');

    // Fill basic content
    await builderPage.fillScriptContent('Welcome to this binaural meditation experience.');
    await builderPage.selectVoice('nova');

    // Add Solfeggio frequency
    await page.click('button:has-text("Frequencies")');
    await page.click('input[name="enable-solfeggio"]');
    await page.selectOption('select[name="solfeggio-frequency"]', '528'); // Love frequency
    await page.fill('input[name="solfeggio-volume"]', '-30');

    // Add Binaural beats
    await page.click('input[name="enable-binaural"]');
    await page.selectOption('select[name="binaural-preset"]', 'theta'); // Meditation
    await page.fill('input[name="binaural-volume"]', '-25');

    // Configure output
    await page.click('button:has-text("Output Settings")');
    await page.selectOption('select[name="format"]', 'wav');
    await page.selectOption('select[name="quality"]', 'high');

    // Preview with all layers
    await builderPage.clickPreview();

    // Verify layer visualizer shows all components
    await expect(page.locator('[data-testid="layer-voice"]')).toBeVisible();
    await expect(page.locator('[data-testid="layer-solfeggio"]')).toBeVisible();
    await expect(page.locator('[data-testid="layer-binaural"]')).toBeVisible();

    // Publish
    await builderPage.clickPublish();

    // Fill metadata
    await page.fill('input[name="title"]', 'Advanced Meditation Experience');
    await page.fill('textarea[name="description"]', 'Multi-layered audio meditation');

    // Add tags
    await page.fill('input[name="tags"]', 'binaural');
    await page.press('input[name="tags"]', 'Enter');
    await page.fill('input[name="tags"]', 'solfeggio');
    await page.press('input[name="tags"]', 'Enter');

    // Submit
    await page.click('button:has-text("Publish Track")');

    // Mock render
    await mockAudioRender(page, `job-${Date.now()}`);

    // Wait for success
    await waitForToast(page, 'Track submitted');
  });

  test('User saves and resumes draft', async ({ page, builderPage }) => {
    await page.goto('/builder');

    // Start creating track
    await builderPage.fillScriptContent('This is my draft meditation...');
    await builderPage.selectVoice('shimmer');

    // Save as draft
    await page.click('button:has-text("Save Draft")');

    // Fill minimal metadata
    await page.fill('input[name="title"]', 'Draft Track');
    await page.click('button:has-text("Save")');

    await waitForToast(page, 'Draft saved');

    // Navigate away
    await libraryPage.navigate();

    // Filter by drafts
    await libraryPage.filterByStatus('draft');

    // Verify draft appears
    const draftCard = await libraryPage.getTrackCard('Draft Track');
    await expect(draftCard).toBeVisible();

    // Click to edit draft
    await draftCard.click();

    // Should load builder with saved content
    await page.waitForURL('**/builder/**');

    // Verify content is loaded
    const scriptTextarea = page.locator('textarea[name="script"]');
    await expect(scriptTextarea).toHaveValue(/This is my draft meditation/);

    // Complete and publish
    await builderPage.fillScriptContent(' ...and now it is complete!');
    await builderPage.clickPublish();

    // Update metadata
    await page.fill('input[name="title"]', 'Completed Track');
    await page.click('button:has-text("Publish Track")');

    // Mock render
    await mockAudioRender(page, `job-${Date.now()}`);

    // Verify status changes from draft to published
    await libraryPage.navigate();
    await libraryPage.verifyTrackStatus('Completed Track', 'Published');
  });

  test('Failed render with retry', async ({ page, builderPage }) => {
    await page.goto('/builder');

    // Create track
    await builderPage.fillScriptContent('Test track for failed render');
    await builderPage.selectVoice('echo');
    await builderPage.clickPublish();

    // Fill metadata
    await page.fill('input[name="title"]', 'Failed Render Test');
    await page.click('button:has-text("Publish Track")');

    // Mock failed render
    await page.route('**/functions/v1/audio-processor', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Audio processing failed: Invalid audio format',
        }),
      });
    });

    // Wait for error
    await waitForToast(page, 'failed', 10000);

    // Verify error state
    await expect(page.locator('text=/render failed/i')).toBeVisible();

    // Click retry
    await page.click('button:has-text("Try Again")');

    // Mock successful render this time
    await mockAudioRender(page, `job-${Date.now()}`);

    // Should succeed
    await waitForToast(page, 'Track submitted');
  });

  test('Batch operations on multiple tracks', async ({ page }) => {
    // Seed multiple tracks
    const track1 = await testDataSeeder.createTestTrack(testUserId, {
      title: 'Track 1',
      status: 'published',
    });
    const track2 = await testDataSeeder.createTestTrack(testUserId, {
      title: 'Track 2',
      status: 'published',
    });
    const track3 = await testDataSeeder.createTestTrack(testUserId, {
      title: 'Track 3',
      status: 'draft',
    });

    await libraryPage.navigate();

    // Select multiple tracks
    await page.click(`[data-testid="track-checkbox-${track1.id}"]`);
    await page.click(`[data-testid="track-checkbox-${track2.id}"]`);

    // Batch action menu should appear
    await expect(page.locator('[data-testid="batch-actions"]')).toBeVisible();

    // Delete selected
    await page.click('button:has-text("Delete Selected")');

    // Confirm
    await page.click('button:has-text("Confirm")');

    await waitForToast(page, '2 tracks deleted');

    // Verify tracks are gone
    await expect(libraryPage.getTrackCard('Track 1')).not.toBeVisible();
    await expect(libraryPage.getTrackCard('Track 2')).not.toBeVisible();

    // Track 3 should still exist
    await expect(libraryPage.getTrackCard('Track 3')).toBeVisible();
  });
});