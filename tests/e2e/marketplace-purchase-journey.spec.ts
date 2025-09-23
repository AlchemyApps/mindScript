import { test, expect } from './fixtures/test-fixtures';
import { MarketplacePage } from './pages/MarketplacePage';
import { LibraryPage } from './pages/LibraryPage';
import {
  mockStripeCheckout,
  waitForToast,
  setupAPIMocks,
} from './utils/test-helpers';
import { testDataSeeder } from './utils/test-data-seeder';

test.describe('Marketplace Purchase Journey', () => {
  let marketplacePage: MarketplacePage;
  let libraryPage: LibraryPage;
  let testScenario: any;

  test.beforeEach(async ({ page }) => {
    // Set up API mocks
    await setupAPIMocks(page);
    await mockStripeCheckout(page);

    // Seed marketplace scenario
    testScenario = await testDataSeeder.seedMarketplaceScenario();

    // Initialize page objects
    marketplacePage = new MarketplacePage(page);
    libraryPage = new LibraryPage(page);
  });

  test.afterEach(async () => {
    // Clean up test data
    if (testScenario) {
      await testDataSeeder.cleanup(testScenario.seller.id);
      await testDataSeeder.cleanup(testScenario.buyer.id);
    }
  });

  test('Browse marketplace and purchase single track', async ({ page, loginPage }) => {
    // Login as buyer
    await loginPage.navigate();
    await loginPage.login(testScenario.buyer.email, testScenario.buyer.password);

    // Navigate to marketplace
    await marketplacePage.navigate();

    // Verify tracks are displayed
    await expect(marketplacePage.getTrackCard('Morning Meditation')).toBeVisible();
    await expect(marketplacePage.getTrackCard('Sleep Soundly')).toBeVisible();

    // Preview track
    await marketplacePage.previewTrack('Morning Meditation');

    // Verify preview player appears
    const previewPlayer = page.locator('[data-testid="preview-player"]');
    await expect(previewPlayer).toBeVisible();

    // Check price
    await marketplacePage.verifyTrackPrice('Morning Meditation', '$4.99');

    // Buy now
    await marketplacePage.buyNow('Morning Meditation');

    // Should redirect to checkout
    await page.waitForURL('**/checkout**');

    // Verify checkout details
    await expect(page.locator('text=/Morning Meditation/i')).toBeVisible();
    await expect(page.locator('text=/$4.99/i')).toBeVisible();

    // Complete checkout (mocked)
    await page.click('button:has-text("Complete Purchase")');

    // Mock successful payment webhook
    await page.evaluate(() => {
      // Simulate Stripe webhook completion
      window.postMessage({
        type: 'STRIPE_CHECKOUT_COMPLETE',
        sessionId: 'cs_test_mock_session',
      }, '*');
    });

    // Wait for success redirect
    await page.waitForURL('**/checkout/success**');

    // Verify success message
    await expect(page.locator('text=/purchase successful/i')).toBeVisible();

    // Navigate to library
    await libraryPage.navigate();

    // Filter by purchased
    await libraryPage.filterByOwnership('purchased');

    // Verify purchased track appears
    const purchasedTrack = await libraryPage.getTrackCard('Morning Meditation');
    await expect(purchasedTrack).toBeVisible();

    // Verify can play
    await libraryPage.playTrack('Morning Meditation');
    await expect(page.locator('audio')).toBeVisible();
  });

  test('Add multiple tracks to cart and checkout', async ({ page, loginPage }) => {
    // Login as buyer
    await loginPage.navigate();
    await loginPage.login(testScenario.buyer.email, testScenario.buyer.password);

    // Navigate to marketplace
    await marketplacePage.navigate();

    // Add first track to cart
    await marketplacePage.addToCart('Morning Meditation');
    await waitForToast(page, 'Added to cart');

    // Verify cart count
    let cartCount = await marketplacePage.getCartItemCount();
    expect(cartCount).toBe(1);

    // Add second track to cart
    await marketplacePage.addToCart('Sleep Soundly');
    await waitForToast(page, 'Added to cart');

    // Verify cart count updated
    cartCount = await marketplacePage.getCartItemCount();
    expect(cartCount).toBe(2);

    // Open cart
    await marketplacePage.openCart();

    // Verify cart contents
    await expect(page.locator('text=/Morning Meditation/i')).toBeVisible();
    await expect(page.locator('text=/Sleep Soundly/i')).toBeVisible();

    // Verify total price
    await expect(page.locator('[data-testid="cart-total"]')).toContainText('$11.98');

    // Remove one item
    await marketplacePage.removeFromCart('Sleep Soundly');

    // Verify updated total
    await expect(page.locator('[data-testid="cart-total"]')).toContainText('$4.99');

    // Re-add the item
    await page.click('[data-testid="close-cart"]');
    await marketplacePage.addToCart('Sleep Soundly');

    // Proceed to checkout
    await marketplacePage.proceedToCheckout();

    // Complete checkout
    await page.click('button:has-text("Complete Purchase")');

    // Wait for success
    await page.waitForURL('**/checkout/success**');

    // Navigate to library
    await libraryPage.navigate();
    await libraryPage.filterByOwnership('purchased');

    // Verify both tracks appear
    await expect(libraryPage.getTrackCard('Morning Meditation')).toBeVisible();
    await expect(libraryPage.getTrackCard('Sleep Soundly')).toBeVisible();
  });

  test('Guest checkout flow', async ({ page }) => {
    // Navigate to marketplace without login
    await marketplacePage.navigate();

    // Browse as guest
    await marketplacePage.searchMarketplace('meditation');

    // Try to purchase
    await marketplacePage.buyNow('Morning Meditation');

    // Should redirect to login with return URL
    await page.waitForURL('**/login**');
    expect(page.url()).toContain('redirect=/checkout');

    // Create account
    await page.click('a:has-text("Sign up")');

    // Fill signup form
    const timestamp = Date.now();
    await page.fill('input[name="email"]', `guest.${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'GuestPassword123!');
    await page.fill('input[name="name"]', `Guest User ${timestamp}`);
    await page.click('button:has-text("Sign Up")');

    // Should redirect back to checkout after signup
    await page.waitForURL('**/checkout**');

    // Complete purchase
    await page.click('button:has-text("Complete Purchase")');

    // Verify success
    await page.waitForURL('**/checkout/success**');
  });

  test('Apply coupon and promotional pricing', async ({ page, loginPage }) => {
    // Create promotional listing
    await testDataSeeder.createTestTrack(testScenario.seller.id, {
      title: 'Limited Offer Track',
      price_cents: 999,
    });

    // Login as buyer
    await loginPage.navigate();
    await loginPage.login(testScenario.buyer.email, testScenario.buyer.password);

    // Navigate to marketplace
    await marketplacePage.navigate();

    // Find promotional track
    const promoTrack = await marketplacePage.getTrackCard('Limited Offer Track');

    // Verify promotional badge
    await expect(promoTrack.locator('[data-testid="promo-badge"]')).toBeVisible();

    // Add to cart
    await marketplacePage.addToCart('Limited Offer Track');

    // Open cart
    await marketplacePage.openCart();

    // Apply coupon code
    await page.fill('input[name="coupon-code"]', 'TESTDISCOUNT20');
    await page.click('button:has-text("Apply")');

    // Verify discount applied
    await waitForToast(page, 'Coupon applied');
    await expect(page.locator('[data-testid="discount-amount"]')).toContainText('-$2.00');

    // Verify new total
    await expect(page.locator('[data-testid="cart-total"]')).toContainText('$7.99');

    // Proceed to checkout with discount
    await marketplacePage.proceedToCheckout();
  });

  test('Filter and sort marketplace listings', async ({ page }) => {
    // Seed additional tracks for filtering
    await testDataSeeder.createTestTrack(testScenario.seller.id, {
      title: 'Expensive Track',
      price_cents: 1999,
      category: 'music',
    });

    await testDataSeeder.createTestTrack(testScenario.seller.id, {
      title: 'Cheap Track',
      price_cents: 99,
      category: 'meditation',
    });

    await marketplacePage.navigate();

    // Filter by category
    await marketplacePage.filterByCategory('meditation');

    // Verify filtered results
    await expect(marketplacePage.getTrackCard('Morning Meditation')).toBeVisible();
    await expect(marketplacePage.getTrackCard('Cheap Track')).toBeVisible();

    // Expensive track should not be visible (different category)
    const expensiveTrack = page.locator('[data-testid="marketplace-track-card"]:has-text("Expensive Track")');
    await expect(expensiveTrack).not.toBeVisible();

    // Reset filter
    await marketplacePage.filterByCategory('all');

    // Filter by price range
    await marketplacePage.filterByPriceRange(1, 10);

    // Only tracks under $10 should be visible
    let trackCount = await marketplacePage.getTrackCount();
    expect(trackCount).toBeLessThan(4); // Not all tracks should show

    // Sort by price (low to high)
    await marketplacePage.sortBy('price-low');

    // Verify order
    const firstTrackPrice = await page.locator('[data-testid="marketplace-track-card"]:first-child [data-testid="track-price"]').textContent();
    expect(firstTrackPrice).toContain('$0.99');

    // Sort by newest
    await marketplacePage.sortBy('newest');

    // Search for specific track
    await marketplacePage.searchMarketplace('Sleep');

    // Verify search results
    await expect(marketplacePage.getTrackCard('Sleep Soundly')).toBeVisible();
    trackCount = await marketplacePage.getTrackCount();
    expect(trackCount).toBe(1);
  });

  test('Seller receives notification of purchase', async ({ page, loginPage }) => {
    // Login as buyer and make purchase
    await loginPage.navigate();
    await loginPage.login(testScenario.buyer.email, testScenario.buyer.password);

    await marketplacePage.navigate();
    await marketplacePage.buyNow('Morning Meditation');
    await page.click('button:has-text("Complete Purchase")');
    await page.waitForURL('**/checkout/success**');

    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('button:has-text("Logout")');

    // Login as seller
    await loginPage.navigate();
    await loginPage.login(testScenario.seller.email, testScenario.seller.password);

    // Navigate to seller dashboard
    await page.goto('/seller/dashboard');

    // Verify sale notification
    await expect(page.locator('[data-testid="notification-badge"]')).toBeVisible();

    // Check earnings
    await expect(page.locator('[data-testid="total-earnings"]')).toContainText('$4.99');

    // Check recent sales
    await expect(page.locator('[data-testid="recent-sales"] :has-text("Morning Meditation")')).toBeVisible();
  });
});