import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LibraryPage extends BasePage {
  readonly tracksGrid: Locator;
  readonly filterButtons: {
    all: Locator;
    owned: Locator;
    purchased: Locator;
  };
  readonly statusFilter: Locator;
  readonly searchInput: Locator;
  readonly sortDropdown: Locator;
  readonly createTrackButton: Locator;

  constructor(page: Page) {
    super(page);

    this.tracksGrid = page.locator('[data-testid="tracks-grid"]');
    this.filterButtons = {
      all: page.locator('button:has-text("All Tracks")'),
      owned: page.locator('button:has-text("My Tracks")'),
      purchased: page.locator('button:has-text("Purchased")'),
    };
    this.statusFilter = page.locator('select[name="status-filter"]');
    this.searchInput = page.locator('input[placeholder*="Search"]');
    this.sortDropdown = page.locator('select[name="sort"]');
    this.createTrackButton = page.locator('a:has-text("Create Track"), button:has-text("Create Track")');
  }

  async navigate() {
    await this.page.goto('/library');
    await this.waitForPageLoad();
  }

  async waitForTracksToLoad() {
    await this.page.waitForSelector('[data-testid="track-card"], [data-testid="tracks-grid"]', {
      timeout: 10000,
    });
  }

  async getTrackCard(title: string): Promise<Locator> {
    return this.page.locator(`[data-testid="track-card"]:has-text("${title}")`);
  }

  async playTrack(title: string) {
    const trackCard = await this.getTrackCard(title);
    const playButton = trackCard.locator('[data-testid="play-button"], button:has-text("Play")');
    await playButton.click();
  }

  async downloadTrack(title: string) {
    const trackCard = await this.getTrackCard(title);
    const downloadButton = trackCard.locator('[data-testid="download-button"], button:has-text("Download")');

    // Set up download promise before clicking
    const downloadPromise = this.page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;

    return download;
  }

  async openTrackMenu(title: string) {
    const trackCard = await this.getTrackCard(title);
    const menuButton = trackCard.locator('[data-testid="track-menu"], button[aria-label*="menu"], button[aria-label*="options"]');
    await menuButton.click();

    // Wait for menu to appear
    await this.page.waitForSelector('[role="menu"]', { state: 'visible' });
  }

  async deleteTrack(title: string) {
    await this.openTrackMenu(title);
    await this.page.click('button:has-text("Delete")');

    // Confirm deletion in dialog
    await this.page.click('button:has-text("Confirm")');
  }

  async filterByOwnership(filter: 'all' | 'owned' | 'purchased') {
    await this.filterButtons[filter].click();
    await this.waitForTracksToLoad();
  }

  async filterByStatus(status: 'all' | 'draft' | 'rendering' | 'published' | 'failed') {
    await this.statusFilter.selectOption(status);
    await this.waitForTracksToLoad();
  }

  async searchTracks(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
    await this.waitForTracksToLoad();
  }

  async sortBy(option: 'created_at' | 'title' | 'duration') {
    await this.sortDropdown.selectOption(option);
    await this.waitForTracksToLoad();
  }

  async getTrackCount(): Promise<number> {
    const tracks = await this.page.locator('[data-testid="track-card"]').all();
    return tracks.length;
  }

  async verifyTrackStatus(title: string, expectedStatus: string) {
    const trackCard = await this.getTrackCard(title);
    const statusBadge = trackCard.locator('[data-testid="status-badge"], [class*="status"]');
    await expect(statusBadge).toContainText(expectedStatus);
  }

  async verifyRenderProgress(title: string) {
    const trackCard = await this.getTrackCard(title);
    const progressBar = trackCard.locator('[data-testid="progress-bar"], [role="progressbar"]');
    await expect(progressBar).toBeVisible();
  }

  async waitForRenderComplete(title: string, timeout = 120000) {
    const trackCard = await this.getTrackCard(title);

    // Wait for status to change to published
    await this.page.waitForFunction(
      (el) => {
        const status = el?.querySelector('[data-testid="status-badge"]');
        return status?.textContent?.toLowerCase().includes('published');
      },
      trackCard.elementHandle(),
      { timeout }
    );
  }

  async navigateToBuilder() {
    await this.createTrackButton.click();
    await this.page.waitForURL('**/builder');
  }
}