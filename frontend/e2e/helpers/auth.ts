import type { Page } from '@playwright/test';

export const FAKE_TOKEN = 'test-jwt-token';

export const FAKE_USER = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  email: 'test@example.com',
  name: 'Test User',
  picture: null,
};

/**
 * Injects a fake auth token into localStorage and mocks the /auth/me endpoint
 * so the app believes the user is authenticated.
 * Waits until the authenticated UI is visible before returning.
 */
export async function loginAs(page: Page, user = FAKE_USER) {
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    }),
  );

  await page.goto('/');

  await page.evaluate(
    ([token]) => localStorage.setItem('typercut_token', token),
    [FAKE_TOKEN],
  );

  await page.reload();

  // Wait for the authenticated app to render (header with user name or app title)
  await page.waitForSelector(`text=${user.name}`, { timeout: 10000 });
}
