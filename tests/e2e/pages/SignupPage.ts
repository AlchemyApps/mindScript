import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class SignupPage extends BasePage {
  private readonly emailInput = 'input[name="email"]';
  private readonly passwordInput = 'input[name="password"]';
  private readonly confirmPasswordInput = 'input[name="confirmPassword"]';
  private readonly nameInput = 'input[name="name"]';
  private readonly signupButton = 'button[type="submit"]:has-text("Sign up")';
  private readonly loginLink = 'a:has-text("Sign in")';
  private readonly termsCheckbox = 'input[type="checkbox"][name="terms"]';
  private readonly errorMessage = '[role="alert"]';
  private readonly verificationMessage = '[data-testid="verification-message"]';

  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.navigate('/signup');
    await this.waitForPageLoad();
  }

  async signup(email: string, password: string, name: string, acceptTerms = true): Promise<void> {
    await this.fillInput(this.nameInput, name);
    await this.fillInput(this.emailInput, email);
    await this.fillInput(this.passwordInput, password);
    await this.fillInput(this.confirmPasswordInput, password);

    if (acceptTerms) {
      await this.clickElement(this.termsCheckbox);
    }

    await this.clickElement(this.signupButton);
  }

  async getErrorMessage(): Promise<string> {
    await this.waitForElement(this.errorMessage);
    return await this.getText(this.errorMessage);
  }

  async isSignupSuccessful(): Promise<boolean> {
    try {
      await this.waitForElement(this.verificationMessage, 5000);
      return true;
    } catch {
      return false;
    }
  }

  async clickLoginLink(): Promise<void> {
    await this.clickElement(this.loginLink);
  }

  async isSignupButtonEnabled(): Promise<boolean> {
    return await this.page.locator(this.signupButton).isEnabled();
  }

  async setPasswordMismatch(password1: string, password2: string): Promise<void> {
    await this.fillInput(this.passwordInput, password1);
    await this.fillInput(this.confirmPasswordInput, password2);
  }

  async getPasswordError(): Promise<string> {
    const errorElement = this.page.locator('[data-testid="password-error"]');
    return await errorElement.textContent() || '';
  }
}