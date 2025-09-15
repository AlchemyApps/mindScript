import { test, expect } from './fixtures/test-fixtures';

test.describe('Track Builder', () => {
  test.beforeEach(async ({ loginPage }) => {
    // Login before each test
    await loginPage.goto();
    await loginPage.login('test@example.com', 'password123');
    await loginPage.isLoginSuccessful();
  });

  test('should navigate to builder page', async ({ builderPage, page }) => {
    await builderPage.goto();
    await expect(page).toHaveURL(/\/builder/);
  });

  test('should create a basic audio track', async ({ builderPage }) => {
    await builderPage.goto();

    // Fill in track details
    await builderPage.setTitle('Test Meditation Track');
    await builderPage.setDescription('A relaxing meditation track for testing');
    await builderPage.setScript('Welcome to this peaceful meditation. Take a deep breath and relax.');
    await builderPage.selectVoice('alloy');
    await builderPage.selectBackgroundMusic('calm_waves');

    // Generate audio
    await builderPage.clickGenerate();
    await builderPage.waitForAudioGeneration();

    // Verify audio player appears
    const isPlayerVisible = await builderPage.isAudioPlayerVisible();
    expect(isPlayerVisible).toBeTruthy();
  });

  test('should validate script length', async ({ builderPage }) => {
    await builderPage.goto();

    // Try with empty script
    await builderPage.setScript('');
    let isEnabled = await builderPage.isGenerateButtonEnabled();
    expect(isEnabled).toBeFalsy();

    // Try with valid script
    await builderPage.setScript('This is a valid script with enough content.');
    isEnabled = await builderPage.isGenerateButtonEnabled();
    expect(isEnabled).toBeTruthy();
  });

  test('should show character count', async ({ builderPage }) => {
    await builderPage.goto();

    const testScript = 'This is a test script.';
    await builderPage.setScript(testScript);

    const count = await builderPage.getCharacterCount();
    expect(count).toContain(testScript.length.toString());
  });

  test('should preview audio before saving', async ({ builderPage }) => {
    await builderPage.goto();

    await builderPage.setTitle('Preview Test');
    await builderPage.setScript('Test script for preview functionality.');
    await builderPage.selectVoice('echo');

    await builderPage.clickGenerate();
    await builderPage.waitForAudioGeneration();

    await builderPage.clickPreview();
    const isPlayerVisible = await builderPage.isAudioPlayerVisible();
    expect(isPlayerVisible).toBeTruthy();
  });

  test('should save track as draft', async ({ builderPage, page }) => {
    await builderPage.goto();

    await builderPage.setTitle('Draft Track');
    await builderPage.setScript('This track will be saved as a draft.');
    await builderPage.selectVoice('nova');

    await builderPage.clickGenerate();
    await builderPage.waitForAudioGeneration();

    await builderPage.clickSave();

    // Check for success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('saved');
  });

  test('should publish track to library', async ({ builderPage, page }) => {
    await builderPage.goto();

    await builderPage.setTitle('Published Track');
    await builderPage.setDescription('This track will be published to the library.');
    await builderPage.setScript('Welcome to your published meditation experience.');
    await builderPage.selectVoice('alloy');
    await builderPage.selectBackgroundMusic('forest_sounds');

    await builderPage.clickGenerate();
    await builderPage.waitForAudioGeneration();

    await builderPage.clickPublish();

    // Check for success and redirect
    await expect(page).toHaveURL(/\/library/);
  });

  test('should adjust frequency settings', async ({ builderPage }) => {
    await builderPage.goto();

    await builderPage.setFrequency('432');
    await builderPage.setVolume('75');

    await builderPage.setScript('Testing frequency adjustments.');
    await builderPage.clickGenerate();

    // Verify settings are applied (would need actual verification in real app)
    await builderPage.waitForAudioGeneration();
    const isPlayerVisible = await builderPage.isAudioPlayerVisible();
    expect(isPlayerVisible).toBeTruthy();
  });

  test('should download generated audio', async ({ builderPage }) => {
    await builderPage.goto();

    await builderPage.setTitle('Download Test');
    await builderPage.setScript('This audio will be downloaded.');
    await builderPage.selectVoice('onyx');

    await builderPage.clickGenerate();
    await builderPage.waitForAudioGeneration();

    // Download should trigger
    await builderPage.downloadAudio();
  });

  test('should handle generation errors gracefully', async ({ builderPage, page }) => {
    await builderPage.goto();

    // Simulate error by using invalid settings
    await builderPage.setScript('x'.repeat(5001)); // Exceed character limit

    await builderPage.clickGenerate();

    // Should show error message
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });
});