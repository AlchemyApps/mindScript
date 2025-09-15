import { test, expect } from './fixtures/test-fixtures';

test.describe('Authentication', () => {
  test.describe('Login', () => {
    test('should login with valid credentials', async ({ loginPage }) => {
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');

      const isSuccess = await loginPage.isLoginSuccessful();
      expect(isSuccess).toBeTruthy();
    });

    test('should show error with invalid credentials', async ({ loginPage }) => {
      await loginPage.goto();
      await loginPage.login('invalid@example.com', 'wrongpassword');

      const errorMessage = await loginPage.getErrorMessage();
      expect(errorMessage).toContain('Invalid email or password');
    });

    test('should show error with empty fields', async ({ loginPage }) => {
      await loginPage.goto();
      await loginPage.clickElement('button[type="submit"]');

      const isEnabled = await loginPage.isLoginButtonEnabled();
      expect(isEnabled).toBeFalsy();
    });

    test('should navigate to signup page', async ({ loginPage, page }) => {
      await loginPage.goto();
      await loginPage.clickSignupLink();

      await expect(page).toHaveURL(/\/signup/);
    });

    test('should navigate to forgot password', async ({ loginPage, page }) => {
      await loginPage.goto();
      await loginPage.clickForgotPassword();

      await expect(page).toHaveURL(/\/forgot-password/);
    });
  });

  test.describe('Signup', () => {
    test('should create new account', async ({ signupPage, testUser }) => {
      await signupPage.goto();
      await signupPage.signup(testUser.email, testUser.password, testUser.name);

      const isSuccess = await signupPage.isSignupSuccessful();
      expect(isSuccess).toBeTruthy();
    });

    test('should show error for existing email', async ({ signupPage }) => {
      await signupPage.goto();
      await signupPage.signup('existing@example.com', 'password123', 'Test User');

      const errorMessage = await signupPage.getErrorMessage();
      expect(errorMessage).toContain('already exists');
    });

    test('should validate password match', async ({ signupPage }) => {
      await signupPage.goto();
      await signupPage.setPasswordMismatch('password123', 'different456');

      const error = await signupPage.getPasswordError();
      expect(error).toContain('Passwords do not match');
    });

    test('should require terms acceptance', async ({ signupPage }) => {
      await signupPage.goto();
      await signupPage.signup('new@example.com', 'password123', 'Test User', false);

      const isEnabled = await signupPage.isSignupButtonEnabled();
      expect(isEnabled).toBeFalsy();
    });

    test('should navigate to login page', async ({ signupPage, page }) => {
      await signupPage.goto();
      await signupPage.clickLoginLink();

      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session after page refresh', async ({ page, loginPage }) => {
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');
      await loginPage.isLoginSuccessful();

      await page.reload();
      await expect(page).not.toHaveURL(/\/login/);
    });

    test('should logout successfully', async ({ page, loginPage }) => {
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');
      await loginPage.isLoginSuccessful();

      await page.click('button:has-text("Logout")');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect to login for protected routes', async ({ page }) => {
      await page.goto('/builder');
      await expect(page).toHaveURL(/\/login/);
    });
  });
});