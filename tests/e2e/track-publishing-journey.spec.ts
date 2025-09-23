import { test, expect } from './fixtures/test-fixtures';
import { LibraryPage } from './pages/LibraryPage';
import { MarketplacePage } from './pages/MarketplacePage';
import {
  generateTestData,
  mockAudioRender,
  setupAPIMocks,
  waitForToast,
  mockStripeCheckout,
} from './utils/test-helpers';
import { testDataSeeder } from './utils/test-data-seeder';

test.describe('Track Publishing Journey', () => {
  let libraryPage: LibraryPage;
  let marketplacePage: MarketplacePage;
  let testData: ReturnType<typeof generateTestData>;
  let sellerId: string;

  test.beforeEach(async ({ page, loginPage }) => {
    // Set up API mocks
    await setupAPIMocks(page);
    await mockStripeCheckout(page);

    // Generate test data
    testData = generateTestData('publish');

    // Create seller account
    const seller = await testDataSeeder.createTestUser({
      email: testData.email,
      profile: { display_name: 'Test Publisher' },
    });
    sellerId = seller.id;
    await testDataSeeder.createSellerAccount(sellerId);

    // Login as seller
    await loginPage.navigate();
    await loginPage.login(testData.email, seller.password);

    // Initialize page objects
    libraryPage = new LibraryPage(page);
    marketplacePage = new MarketplacePage(page);
  });

  test.afterEach(async () => {
    // Clean up test data
    if (sellerId) {
      await testDataSeeder.cleanup(sellerId);
    }
  });

  test('Build track and publish to marketplace', async ({ page, builderPage }) => {
    // Start in builder
    await page.goto('/builder');

    // Create track content
    await builderPage.fillScriptContent(testData.scriptContent);
    await builderPage.selectVoice('nova');

    // Add background music
    await builderPage.toggleBackgroundMusic();
    await builderPage.selectBackgroundTrack('Ambient Dreams');

    // Preview before publishing
    await builderPage.clickPreview();
    await expect(page.locator('[data-testid="preview-player"]')).toBeVisible();

    // Click publish
    await builderPage.clickPublish();

    // Fill metadata
    await page.fill('input[name="title"]', testData.trackTitle);
    await page.fill('textarea[name="description"]', 'A relaxing meditation for marketplace');
    await page.selectOption('select[name="category"]', 'meditation');

    // Add tags
    await page.fill('input[name="tags"]', 'relaxation');
    await page.press('input[name="tags"]', 'Enter');
    await page.fill('input[name="tags"]', 'mindfulness');
    await page.press('input[name="tags"]', 'Enter');

    // Set as public
    await page.click('input[value="public"]');

    // Enable marketplace listing
    await page.click('input[name="enable-marketplace"]');

    // Set price
    await page.fill('input[name="price"]', '7.99');

    // Add promotional price
    await page.click('input[name="enable-promotional"]');
    await page.fill('input[name="promotional-price"]', '5.99');

    // Submit
    await page.click('button:has-text("Publish to Marketplace")');

    // Mock render process
    await mockAudioRender(page, `job-${testData.timestamp}`);

    // Wait for success
    await waitForToast(page, 'Track published to marketplace');

    // Navigate to marketplace
    await marketplacePage.navigate();

    // Search for the track
    await marketplacePage.searchMarketplace(testData.trackTitle);

    // Verify track appears
    const trackCard = await marketplacePage.getTrackCard(testData.trackTitle);
    await expect(trackCard).toBeVisible();

    // Verify price
    await marketplacePage.verifyTrackPrice(testData.trackTitle, '$5.99');

    // Verify promotional badge
    await expect(trackCard.locator('[data-testid="promo-badge"]')).toBeVisible();

    // Verify seller name
    await marketplacePage.verifySellerName(testData.trackTitle, 'Test Publisher');
  });

  test('Update published track details', async ({ page }) => {
    // Create published track
    const track = await testDataSeeder.createTestTrack(sellerId, {
      title: 'Original Title',
      description: 'Original description',
      price_cents: 499,
      status: 'published',
    });

    await testDataSeeder.createCompletedAudioJob(track.id, sellerId);
    await testDataSeeder.createMarketplaceListing(track.id, sellerId, 499);

    // Navigate to library
    await libraryPage.navigate();

    // Open track menu
    await libraryPage.openTrackMenu('Original Title');

    // Click edit
    await page.click('button:has-text("Edit")');

    // Update details
    await page.fill('input[name="title"]', 'Updated Title');
    await page.fill('textarea[name="description"]', 'Updated description with more details');

    // Update price
    await page.fill('input[name="price"]', '9.99');

    // Save changes
    await page.click('button:has-text("Save Changes")');

    await waitForToast(page, 'Track updated');

    // Verify changes in marketplace
    await marketplacePage.navigate();
    await marketplacePage.searchMarketplace('Updated Title');

    // Verify updated details
    const updatedCard = await marketplacePage.getTrackCard('Updated Title');
    await expect(updatedCard).toBeVisible();
    await marketplacePage.verifyTrackPrice('Updated Title', '$9.99');
  });

  test('Suspend and reactivate marketplace listing', async ({ page }) => {
    // Create published track
    const track = await testDataSeeder.createTestTrack(sellerId, {
      title: 'Active Track',
      status: 'published',
    });

    await testDataSeeder.createCompletedAudioJob(track.id, sellerId);
    await testDataSeeder.createMarketplaceListing(track.id, sellerId);

    // Go to seller dashboard
    await page.goto('/seller/dashboard');

    // Find track in listings
    await page.click(`[data-testid="track-row-${track.id}"]`);

    // Suspend listing
    await page.click('button:has-text("Suspend Listing")');

    // Confirm
    await page.click('button:has-text("Confirm")');

    await waitForToast(page, 'Listing suspended');

    // Verify track no longer in marketplace
    await marketplacePage.navigate();
    await marketplacePage.searchMarketplace('Active Track');

    // Should show no results
    await expect(page.locator('text=/no tracks found/i')).toBeVisible();

    // Go back to dashboard
    await page.goto('/seller/dashboard');

    // Reactivate
    await page.click(`[data-testid="track-row-${track.id}"]`);
    await page.click('button:has-text("Reactivate Listing")');

    await waitForToast(page, 'Listing reactivated');

    // Verify track is back in marketplace
    await marketplacePage.navigate();
    await marketplacePage.searchMarketplace('Active Track');

    await expect(marketplacePage.getTrackCard('Active Track')).toBeVisible();
  });

  test('Track analytics and earnings', async ({ page }) => {
    // Create track with sales history
    const track = await testDataSeeder.createTestTrack(sellerId, {
      title: 'Popular Track',
      price_cents: 999,
      status: 'published',
    });

    await testDataSeeder.createCompletedAudioJob(track.id, sellerId);
    await testDataSeeder.createMarketplaceListing(track.id, sellerId, 999);

    // Simulate purchases
    const buyer1 = await testDataSeeder.createTestUser();
    const buyer2 = await testDataSeeder.createTestUser();

    await testDataSeeder.grantTrackAccess(buyer1.id, track.id);
    await testDataSeeder.grantTrackAccess(buyer2.id, track.id);

    // Navigate to analytics
    await page.goto('/seller/analytics');

    // Verify earnings
    await expect(page.locator('[data-testid="total-earnings"]')).toContainText('$19.98');

    // Verify track performance
    await page.click(`[data-testid="track-analytics-${track.id}"]`);

    // Check metrics
    await expect(page.locator('[data-testid="total-sales"]')).toContainText('2');
    await expect(page.locator('[data-testid="track-revenue"]')).toContainText('$19.98');

    // View sales history
    await page.click('tab:has-text("Sales History")');

    // Verify transactions
    const salesTable = page.locator('[data-testid="sales-table"]');
    await expect(salesTable.locator('tr')).toHaveCount(3); // Header + 2 sales
  });

  test('Seller payout process', async ({ page }) => {
    // Create tracks with earnings
    const track1 = await testDataSeeder.createTestTrack(sellerId, {
      title: 'Track 1',
      price_cents: 999,
      status: 'published',
    });

    // Simulate multiple sales
    for (let i = 0; i < 5; i++) {
      const buyer = await testDataSeeder.createTestUser();
      await testDataSeeder.grantTrackAccess(buyer.id, track1.id);
    }

    // Navigate to payouts
    await page.goto('/seller/payouts');

    // Check available balance
    await expect(page.locator('[data-testid="available-balance"]')).toContainText('$49.95');

    // Request payout
    await page.click('button:has-text("Request Payout")');

    // Verify minimum threshold
    await expect(page.locator('[data-testid="payout-amount"]')).toHaveValue('49.95');

    // Confirm payout
    await page.click('button:has-text("Confirm Payout")');

    // Mock Stripe Connect payout
    await page.route('**/api/seller/payouts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          payoutId: 'po_test_123',
          amount: 4995,
          status: 'pending',
        }),
      });
    });

    await waitForToast(page, 'Payout requested');

    // Check payout history
    await page.click('tab:has-text("Payout History")');

    // Verify payout entry
    await expect(page.locator('[data-testid="payout-po_test_123"]')).toBeVisible();
    await expect(page.locator('[data-testid="payout-status"]')).toContainText('Pending');
  });

  test('Content moderation and review', async ({ page }) => {
    // Create track pending review
    const track = await testDataSeeder.createTestTrack(sellerId, {
      title: 'Pending Review Track',
      description: 'This track needs moderation',
      status: 'draft',
    });

    // Submit for review
    await libraryPage.navigate();
    await libraryPage.openTrackMenu('Pending Review Track');
    await page.click('button:has-text("Submit for Review")');

    // Add review notes
    await page.fill('textarea[name="review-notes"]', 'Please review for marketplace listing');
    await page.click('button:has-text("Submit")');

    await waitForToast(page, 'Submitted for review');

    // Verify status
    await libraryPage.verifyTrackStatus('Pending Review Track', 'Under Review');

    // Simulate admin approval (would normally be done by admin)
    await page.evaluate(async (trackId) => {
      // Mock admin approval webhook
      await fetch('/api/webhooks/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId,
          status: 'approved',
          notes: 'Content approved for marketplace',
        }),
      });
    }, track.id);

    // Refresh page
    await page.reload();

    // Verify approval
    await libraryPage.verifyTrackStatus('Pending Review Track', 'Published');

    // Check marketplace
    await marketplacePage.navigate();
    await marketplacePage.searchMarketplace('Pending Review Track');

    await expect(marketplacePage.getTrackCard('Pending Review Track')).toBeVisible();
  });
});