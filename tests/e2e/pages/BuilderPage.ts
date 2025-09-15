import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class BuilderPage extends BasePage {
  private readonly scriptTextarea = 'textarea[name="script"]';
  private readonly voiceSelect = 'select[name="voice"]';
  private readonly backgroundMusicSelect = 'select[name="backgroundMusic"]';
  private readonly frequencySlider = 'input[type="range"][name="frequency"]';
  private readonly volumeSlider = 'input[type="range"][name="volume"]';
  private readonly titleInput = 'input[name="title"]';
  private readonly descriptionTextarea = 'textarea[name="description"]';
  private readonly generateButton = 'button:has-text("Generate Audio")';
  private readonly previewButton = 'button:has-text("Preview")';
  private readonly saveButton = 'button:has-text("Save")';
  private readonly publishButton = 'button:has-text("Publish")';
  private readonly progressBar = '[data-testid="progress-bar"]';
  private readonly audioPlayer = 'audio[data-testid="audio-player"]';
  private readonly downloadButton = 'a[download]:has-text("Download")';

  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.navigate('/builder');
    await this.waitForPageLoad();
  }

  async setScript(text: string): Promise<void> {
    await this.fillInput(this.scriptTextarea, text);
  }

  async selectVoice(voice: string): Promise<void> {
    await this.selectOption(this.voiceSelect, voice);
  }

  async selectBackgroundMusic(music: string): Promise<void> {
    await this.selectOption(this.backgroundMusicSelect, music);
  }

  async setFrequency(value: string): Promise<void> {
    await this.page.locator(this.frequencySlider).fill(value);
  }

  async setVolume(value: string): Promise<void> {
    await this.page.locator(this.volumeSlider).fill(value);
  }

  async setTitle(title: string): Promise<void> {
    await this.fillInput(this.titleInput, title);
  }

  async setDescription(description: string): Promise<void> {
    await this.fillInput(this.descriptionTextarea, description);
  }

  async clickGenerate(): Promise<void> {
    await this.clickElement(this.generateButton);
  }

  async clickPreview(): Promise<void> {
    await this.clickElement(this.previewButton);
  }

  async clickSave(): Promise<void> {
    await this.clickElement(this.saveButton);
  }

  async clickPublish(): Promise<void> {
    await this.clickElement(this.publishButton);
  }

  async waitForAudioGeneration(): Promise<void> {
    await this.waitForElement(this.progressBar);
    await this.page.waitForSelector(this.progressBar, { state: 'hidden', timeout: 60000 });
  }

  async isAudioPlayerVisible(): Promise<boolean> {
    return await this.isElementVisible(this.audioPlayer);
  }

  async playAudio(): Promise<void> {
    await this.page.locator(this.audioPlayer).evaluate((audio: HTMLAudioElement) => {
      audio.play();
    });
  }

  async pauseAudio(): Promise<void> {
    await this.page.locator(this.audioPlayer).evaluate((audio: HTMLAudioElement) => {
      audio.pause();
    });
  }

  async getAudioDuration(): Promise<number> {
    return await this.page.locator(this.audioPlayer).evaluate((audio: HTMLAudioElement) => {
      return audio.duration;
    });
  }

  async downloadAudio(): Promise<void> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.clickElement(this.downloadButton)
    ]);
    await download.saveAs(`test-results/downloads/${download.suggestedFilename()}`);
  }

  async getCharacterCount(): Promise<string> {
    const counter = this.page.locator('[data-testid="character-count"]');
    return await counter.textContent() || '0';
  }

  async isGenerateButtonEnabled(): Promise<boolean> {
    return await this.page.locator(this.generateButton).isEnabled();
  }
}