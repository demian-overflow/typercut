import { test, expect } from '@playwright/test';
import { loginAs, FAKE_USER } from './helpers/auth';

test.describe('Authentication', () => {
  test('shows login page when unauthenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Continue with Google')).toBeVisible();
  });

  test('login button links to backend OAuth endpoint', async ({ page }) => {
    await page.goto('/');
    const loginButton = page.getByText('Continue with Google');
    const href = await loginButton.getAttribute('href');
    expect(href).toContain('/auth/google');
  });

  test('shows app when authenticated', async ({ page }) => {
    await loginAs(page);
    await expect(page.getByText('typercut')).toBeVisible();
    await expect(page.getByText(FAKE_USER.name)).toBeVisible();
    await expect(page.getByText('Sign out')).toBeVisible();
  });

  test('sign out clears session and returns to login', async ({ page }) => {
    await loginAs(page);
    await page.getByText('Sign out').click();
    await expect(page.getByText('Continue with Google')).toBeVisible();
  });

  test('stores token from ?token= query param after OAuth redirect', async ({ page }) => {
    const token = 'oauth-redirect-test-token';

    await page.route('**/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_USER),
      }),
    );

    await page.goto(`/?token=${token}`);

    // Token should be stored and URL cleaned up
    const stored = await page.evaluate(() => localStorage.getItem('typercut_token'));
    expect(stored).toBe(token);

    // URL should not contain ?token= anymore
    await expect(page).not.toHaveURL(/token=/);
  });
});
