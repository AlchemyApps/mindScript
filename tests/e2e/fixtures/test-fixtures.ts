import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { BuilderPage } from '../pages/BuilderPage';

type TestFixtures = {
  loginPage: LoginPage;
  signupPage: SignupPage;
  builderPage: BuilderPage;
  testUser: {
    email: string;
    password: string;
    name: string;
  };
};

export const test = base.extend<TestFixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  signupPage: async ({ page }, use) => {
    const signupPage = new SignupPage(page);
    await use(signupPage);
  },

  builderPage: async ({ page }, use) => {
    const builderPage = new BuilderPage(page);
    await use(builderPage);
  },

  testUser: async ({}, use) => {
    const timestamp = Date.now();
    const user = {
      email: `test.user.${timestamp}@example.com`,
      password: 'TestPassword123!',
      name: `Test User ${timestamp}`,
    };
    await use(user);
  },
});

export { expect } from '@playwright/test';