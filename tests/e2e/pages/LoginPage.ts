import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  private readonly emailInput = 'input[name="email"]';
  private readonly passwordInput = 'input[name="password"]';
  private readonly loginButton = 'button[type="submit"]:has-text("Sign in")';
  private readonly signupLink = 'a:has-text("Sign up")';
  private readonly forgotPasswordLink = 'a:has-text("Forgot password")';
  private readonly errorMessage = '[role="alert"]';
  private readonly successMessage = '[data-testid="success-message"]';

  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.navigate('/login');
    await this.waitForPageLoad();
  }

  async login(email: string, password: string): Promise<void> {
    await this.fillInput(this.emailInput, email);
    await this.fillInput(this.passwordInput, password);
    await this.clickElement(this.loginButton);
  }

  async getErrorMessage(): Promise<string> {
    await this.waitForElement(this.errorMessage);
    return await this.getText(this.errorMessage);
  }

  async isLoginSuccessful(): Promise<boolean> {
    try {
      await this.page.waitForURL(/\/(dashboard|library)/, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async clickSignupLink(): Promise<void> {
    await this.clickElement(this.signupLink);
  }

  async clickForgotPassword(): Promise<void> {
    await this.clickElement(this.forgotPasswordLink);
  }

  async isLoginButtonEnabled(): Promise<boolean> {
    return await this.page.locator(this.loginButton).isEnabled();
  }

  async clearCredentials(): Promise<void> {
    await this.clearInput(this.emailInput);
    await this.clearInput(this.passwordInput);
  }
}