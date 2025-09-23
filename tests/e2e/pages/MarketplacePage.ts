import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class MarketplacePage extends BasePage {
  readonly searchInput: Locator;
  readonly categoryFilter: Locator;
  readonly priceRangeFilter: Locator;
  readonly sortDropdown: Locator;
  readonly tracksGrid: Locator;
  readonly cartButton: Locator;
  readonly cartItemCount: Locator;

  constructor(page: Page) {
    super(page);

    this.searchInput = page.locator('input[placeholder*="Search marketplace"]');
    this.categoryFilter = page.locator('[data-testid="category-filter"], select[name="category"]');
    this.priceRangeFilter = page.locator('[data-testid="price-filter"]');
    this.sortDropdown = page.locator('select[name="sort"], [data-testid="sort-dropdown"]');
    this.tracksGrid = page.locator('[data-testid="marketplace-grid"]');
    this.cartButton = page.locator('[data-testid="cart-button"], button[aria-label*="cart"]');
    this.cartItemCount = page.locator('[data-testid="cart-count"]');
  }

  async navigate() {
    await this.page.goto('/marketplace');
    await this.waitForPageLoad();
  }

  async waitForTracksToLoad() {
    await this.page.waitForSelector('[data-testid="marketplace-track-card"]', {
      timeout: 10000,
    });
  }

  async getTrackCard(title: string): Promise<Locator> {
    return this.page.locator(`[data-testid="marketplace-track-card"]:has-text("${title}")`);
  }

  async previewTrack(title: string) {
    const trackCard = await this.getTrackCard(title);
    const previewButton = trackCard.locator('[data-testid="preview-button"], button:has-text("Preview")');
    await previewButton.click();

    // Wait for audio player to appear
    await this.page.waitForSelector('[data-testid="preview-player"], audio', { state: 'visible' });
  }

  async addToCart(title: string) {
    const trackCard = await this.getTrackCard(title);
    const addButton = trackCard.locator('[data-testid="add-to-cart"], button:has-text("Add to Cart")');
    await addButton.click();

    // Wait for cart update
    await this.page.waitForTimeout(500);
  }

  async buyNow(title: string) {
    const trackCard = await this.getTrackCard(title);
    const buyButton = trackCard.locator('[data-testid="buy-now"], button:has-text("Buy Now")');
    await buyButton.click();

    // Should navigate to checkout
    await this.page.waitForURL('**/checkout**');
  }

  async openCart() {
    await this.cartButton.click();
    await this.page.waitForSelector('[data-testid="cart-modal"], [role="dialog"]', { state: 'visible' });
  }

  async getCartItemCount(): Promise<number> {
    const countText = await this.cartItemCount.textContent();
    return parseInt(countText || '0', 10);
  }

  async removeFromCart(title: string) {
    await this.openCart();

    const cartItem = this.page.locator(`[data-testid="cart-item"]:has-text("${title}")`);
    const removeButton = cartItem.locator('[data-testid="remove-item"], button:has-text("Remove")');
    await removeButton.click();

    // Wait for cart update
    await this.page.waitForTimeout(500);
  }

  async proceedToCheckout() {
    await this.openCart();

    const checkoutButton = this.page.locator('[data-testid="checkout-button"], button:has-text("Checkout")');
    await checkoutButton.click();

    // Should navigate to checkout
    await this.page.waitForURL('**/checkout**');
  }

  async filterByCategory(category: string) {
    await this.categoryFilter.selectOption(category);
    await this.waitForTracksToLoad();
  }

  async filterByPriceRange(min: number, max: number) {
    const minInput = this.page.locator('input[name="price-min"]');
    const maxInput = this.page.locator('input[name="price-max"]');

    await minInput.fill(min.toString());
    await maxInput.fill(max.toString());

    // Apply filter
    const applyButton = this.page.locator('button:has-text("Apply")');
    if (await applyButton.isVisible()) {
      await applyButton.click();
    }

    await this.waitForTracksToLoad();
  }

  async searchMarketplace(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.waitForTracksToLoad();
  }

  async sortBy(option: 'newest' | 'price-low' | 'price-high' | 'popular') {
    await this.sortDropdown.selectOption(option);
    await this.waitForTracksToLoad();
  }

  async verifyTrackPrice(title: string, expectedPrice: string) {
    const trackCard = await this.getTrackCard(title);
    const priceElement = trackCard.locator('[data-testid="track-price"], [class*="price"]');
    await expect(priceElement).toContainText(expectedPrice);
  }

  async verifySellerName(title: string, sellerName: string) {
    const trackCard = await this.getTrackCard(title);
    const sellerElement = trackCard.locator('[data-testid="seller-name"], [class*="seller"]');
    await expect(sellerElement).toContainText(sellerName);
  }

  async getTrackCount(): Promise<number> {
    const tracks = await this.page.locator('[data-testid="marketplace-track-card"]').all();
    return tracks.length;
  }
}