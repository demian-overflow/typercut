import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const DEFAULT_TEXT = 'The quick brown fox jumps over the lazy dog.';

async function typeText(page: import('@playwright/test').Page, text: string) {
  const typingArea = page.getByTestId('typing-area');
  await typingArea.focus();
  for (const char of text) {
    await page.keyboard.press(char === ' ' ? 'Space' : char);
  }
}

test.describe('Typing exercise', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    // App starts in 'typing' state with DEFAULT_TEXT
  });

  test('shows idle hint before typing starts', async ({ page }) => {
    await expect(page.getByText('Click here and start typing')).toBeVisible();
  });

  test('shows Esc hint before completion', async ({ page }) => {
    await expect(page.getByText('Esc to reset')).toBeVisible();
  });

  test('first keypress starts the timer and shows live WPM', async ({ page }) => {
    const typingArea = page.getByTestId('typing-area');
    await typingArea.focus();
    await page.keyboard.press('T');

    await expect(page.getByText(/WPM/)).toBeVisible();
    // Idle hint should be gone
    await expect(page.getByText('Click here and start typing')).not.toBeVisible();
  });

  test('Escape key resets back to idle state', async ({ page }) => {
    const typingArea = page.getByTestId('typing-area');
    await typingArea.focus();
    await page.keyboard.press('T');
    await expect(page.getByText(/WPM/)).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByText('Click here and start typing')).toBeVisible();
    await expect(page.getByText(/\d+ WPM/)).not.toBeVisible();
  });

  test('completing the full text shows the results panel', async ({ page }) => {
    await typeText(page, DEFAULT_TEXT);

    await expect(page.getByText('WPM')).toBeVisible();
    await expect(page.getByText('Accuracy')).toBeVisible();
    await expect(page.getByText('Time')).toBeVisible();
    await expect(page.getByText('Try Again')).toBeVisible();
    await expect(page.getByText('New Text')).toBeVisible();
  });

  test('WPM is a positive number after completing the text', async ({ page }) => {
    await typeText(page, DEFAULT_TEXT);

    // First .text-2xl is the WPM value
    const wpmValue = await page.locator('.text-2xl').first().textContent();
    expect(Number(wpmValue)).toBeGreaterThan(0);
  });

  test('typing all characters correctly gives 100% accuracy', async ({ page }) => {
    await typeText(page, DEFAULT_TEXT);

    await expect(page.getByText('100%')).toBeVisible();
  });

  test('"Try Again" resets to idle with the same text', async ({ page }) => {
    await typeText(page, DEFAULT_TEXT);

    await page.getByText('Try Again').click();

    await expect(page.getByText('Click here and start typing')).toBeVisible();
    await expect(page.getByText('Try Again')).not.toBeVisible();
  });

  test('"New Text" navigates back to the setup screen', async ({ page }) => {
    await typeText(page, DEFAULT_TEXT);

    await page.getByText('New Text').click();

    await expect(page.getByText('AI Generate')).toBeVisible();
    await expect(page.getByText('Ingest Material')).toBeVisible();
  });

  test('typing a wrong character marks it red', async ({ page }) => {
    const typingArea = page.getByTestId('typing-area');
    await typingArea.focus();

    // Type wrong first char (DEFAULT_TEXT starts with 'T')
    await page.keyboard.press('X');

    // A span with red text class should exist
    await expect(page.locator('.text-red-500')).toBeVisible();
  });

  test('backspace undoes the last character back to pending', async ({ page }) => {
    const typingArea = page.getByTestId('typing-area');
    await typingArea.focus();

    // Type the first word "The" correctly — the whole word turns green
    await page.keyboard.press('T');
    await page.keyboard.press('h');
    await page.keyboard.press('e');
    await expect(page.locator('.text-green-500').first()).toBeVisible();

    // Backspace once: 'e' resets to pending — word is no longer all-correct → goes gray
    await page.keyboard.press('Backspace');
    await expect(page.locator('.text-green-500')).not.toBeVisible();
  });
});
