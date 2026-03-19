import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';

const FAKE_MATERIAL = {
  id: 'mat-00000000-0000-0000-0000-000000000001',
  title: 'Cell Biology Notes',
  content: 'Mitosis is the process of cell division.',
  created_at: new Date().toISOString(),
};

const FAKE_SNIPPETS = [
  {
    id: 'snp-0001',
    material_id: FAKE_MATERIAL.id,
    text: 'Mitosis is the process by which a cell divides into two identical daughter cells.',
    word_count: 14,
  },
  {
    id: 'snp-0002',
    material_id: FAKE_MATERIAL.id,
    text: 'The cell cycle consists of interphase and the mitotic phase.',
    word_count: 11,
  },
  {
    id: 'snp-0003',
    material_id: FAKE_MATERIAL.id,
    text: 'During prophase chromatin condenses into visible chromosomes.',
    word_count: 8,
  },
];

// Shape returned by /materials/upload and /materials/from-github
const INGEST_RESULT = {
  material: { id: FAKE_MATERIAL.id, title: FAKE_MATERIAL.title },
  snippets: FAKE_SNIPPETS,
};

const DEFAULT_TEXT = 'The quick brown fox jumps over the lazy dog.';

async function navigateToSetup(page: Page) {
  const typingArea = page.getByTestId('typing-area');
  await typingArea.focus();
  for (const char of DEFAULT_TEXT) {
    await page.keyboard.press(char === ' ' ? 'Space' : char);
  }
  await page.getByText('New Text').click();
}

async function openIngestTab(page: Page) {
  await page.getByText('Ingest Material').click();
}

test.describe('Material ingestion', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await navigateToSetup(page);
  });

  // ── App-level setup tabs ───────────────────────────────────────────────────

  test('setup screen has two tabs: AI Generate and Ingest Material', async ({ page }) => {
    await expect(page.getByText('AI Generate')).toBeVisible();
    await expect(page.getByText('Ingest Material')).toBeVisible();
  });

  // ── Ingest Material: Paste sub-tab ────────────────────────────────────────

  test('Ingest Material shows Paste / Upload File / GitHub sub-tabs', async ({ page }) => {
    await openIngestTab(page);
    await expect(page.getByText('Paste Text')).toBeVisible();
    await expect(page.getByText('Upload File')).toBeVisible();
    await expect(page.getByText('GitHub')).toBeVisible();
  });

  test('Paste tab: submit button is disabled when inputs are empty', async ({ page }) => {
    await openIngestTab(page);

    const btn = page.getByText('Ingest & Extract Snippets');
    await expect(btn).toBeDisabled();

    await page.getByPlaceholder(/Chapter 3/).fill('My Notes');
    await expect(btn).toBeDisabled();

    await page.getByPlaceholder(/Paste any text/i).fill('Some content here');
    await expect(btn).toBeEnabled();
  });

  test('Paste tab: shows live word count', async ({ page }) => {
    await openIngestTab(page);
    await page.getByPlaceholder(/Paste any text/i).fill('one two three four five');
    await expect(page.getByText('(5 words)')).toBeVisible();
  });

  test('Paste tab: successful ingestion transitions to snippet browser', async ({ page }) => {
    await page.route('**/materials', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(FAKE_MATERIAL) });
      } else {
        await route.continue();
      }
    });
    await page.route(`**/materials/${FAKE_MATERIAL.id}/process`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_SNIPPETS) }),
    );

    await openIngestTab(page);
    await page.getByPlaceholder(/Chapter 3/).fill(FAKE_MATERIAL.title);
    await page.getByPlaceholder(/Paste any text/i).fill(FAKE_MATERIAL.content);
    await page.getByText('Ingest & Extract Snippets').click();

    await expect(page.getByText(`${FAKE_SNIPPETS.length} snippets extracted`)).toBeVisible();
    for (const s of FAKE_SNIPPETS) {
      await expect(page.getByText(s.text)).toBeVisible();
    }
  });

  test('Paste tab: shows error and re-enables form when backend fails', async ({ page }) => {
    await page.route('**/materials', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, body: '{"error":"Database error"}' });
      } else {
        await route.continue();
      }
    });

    await openIngestTab(page);
    await page.getByPlaceholder(/Chapter 3/).fill('Test');
    await page.getByPlaceholder(/Paste any text/i).fill('Some content');
    await page.getByText('Ingest & Extract Snippets').click();

    await expect(page.getByText(/failed|error/i)).toBeVisible();
    await expect(page.getByText('Ingest & Extract Snippets')).toBeEnabled();
  });

  // ── Ingest Material: File upload sub-tab ─────────────────────────────────

  test('File tab: shows drop zone and upload button', async ({ page }) => {
    await openIngestTab(page);
    await page.getByText('Upload File').click();

    await expect(page.getByText(/Drop a file here/i)).toBeVisible();
    await expect(page.getByText('Upload & Extract Snippets')).toBeVisible();
    await expect(page.getByText('Upload & Extract Snippets')).toBeDisabled();
  });

  test('File tab: selecting a file enables the upload button', async ({ page }) => {
    await openIngestTab(page);
    await page.getByText('Upload File').click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText(/Drop a file here/i).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Some plain text content for typing practice.'),
    });

    await expect(page.getByText('notes.txt')).toBeVisible();
    await expect(page.getByText('Upload & Extract Snippets')).toBeEnabled();
  });

  test('File tab: successful upload transitions to snippet browser', async ({ page }) => {
    await page.route('**/materials/upload', (route) =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(INGEST_RESULT) }),
    );

    await openIngestTab(page);
    await page.getByText('Upload File').click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText(/Drop a file here/i).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'biology.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(FAKE_MATERIAL.content),
    });

    await page.getByText('Upload & Extract Snippets').click();

    await expect(page.getByText(`${FAKE_SNIPPETS.length} snippets extracted`)).toBeVisible();
  });

  test('File tab: shows error on upload failure', async ({ page }) => {
    await page.route('**/materials/upload', (route) =>
      route.fulfill({ status: 422, body: '{"detail":"Could not extract any text from the file"}' }),
    );

    await openIngestTab(page);
    await page.getByText('Upload File').click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText(/Drop a file here/i).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'empty.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(''),
    });

    await page.getByText('Upload & Extract Snippets').click();
    await expect(page.locator('.text-red-600')).toBeVisible();
    await expect(page.getByText('Upload & Extract Snippets')).toBeEnabled();
  });

  // ── Ingest Material: GitHub sub-tab ──────────────────────────────────────

  test('GitHub tab: shows URL input and fetch button', async ({ page }) => {
    await openIngestTab(page);
    await page.getByText('GitHub').click();

    await expect(page.getByPlaceholder(/github.com\/owner\/repo/)).toBeVisible();
    await expect(page.getByText('Fetch & Extract Snippets')).toBeVisible();
    await expect(page.getByText('Fetch & Extract Snippets')).toBeDisabled();
  });

  test('GitHub tab: typing a URL enables the fetch button', async ({ page }) => {
    await openIngestTab(page);
    await page.getByText('GitHub').click();

    await page.getByPlaceholder(/github.com\/owner\/repo/).fill('https://github.com/rust-lang/rust');
    await expect(page.getByText('Fetch & Extract Snippets')).toBeEnabled();
  });

  test('GitHub tab: successful fetch transitions to snippet browser', async ({ page }) => {
    await page.route('**/materials/from-github', (route) =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(INGEST_RESULT) }),
    );

    await openIngestTab(page);
    await page.getByText('GitHub').click();
    await page.getByPlaceholder(/github.com\/owner\/repo/).fill('https://github.com/rust-lang/rust');
    await page.getByText('Fetch & Extract Snippets').click();

    await expect(page.getByText(`${FAKE_SNIPPETS.length} snippets extracted`)).toBeVisible();
  });

  test('GitHub tab: shows error on bad URL', async ({ page }) => {
    await page.route('**/materials/from-github', (route) =>
      route.fulfill({ status: 422, body: '{"error":"Not a GitHub URL"}' }),
    );

    await openIngestTab(page);
    await page.getByText('GitHub').click();
    await page.getByPlaceholder(/github.com\/owner\/repo/).fill('https://example.com/something');
    await page.getByText('Fetch & Extract Snippets').click();

    await expect(page.locator('.text-red-600')).toBeVisible();
    await expect(page.getByText('Fetch & Extract Snippets')).toBeEnabled();
  });

  // ── Snippet browser shared behaviour ─────────────────────────────────────

  test('clicking a snippet starts the typing exercise', async ({ page }) => {
    await page.route('**/materials', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(FAKE_MATERIAL) });
      } else {
        await route.continue();
      }
    });
    await page.route(`**/materials/${FAKE_MATERIAL.id}/process`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_SNIPPETS) }),
    );

    await openIngestTab(page);
    await page.getByPlaceholder(/Chapter 3/).fill(FAKE_MATERIAL.title);
    await page.getByPlaceholder(/Paste any text/i).fill(FAKE_MATERIAL.content);
    await page.getByText('Ingest & Extract Snippets').click();

    await page.getByText(FAKE_SNIPPETS[0].text).click();
    await expect(page.getByText('Click here and start typing')).toBeVisible();
  });

  test('"Random Snippet" picks one and starts the exercise', async ({ page }) => {
    await page.route('**/materials', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(FAKE_MATERIAL) });
      } else {
        await route.continue();
      }
    });
    await page.route(`**/materials/${FAKE_MATERIAL.id}/process`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_SNIPPETS) }),
    );

    await openIngestTab(page);
    await page.getByPlaceholder(/Chapter 3/).fill(FAKE_MATERIAL.title);
    await page.getByPlaceholder(/Paste any text/i).fill(FAKE_MATERIAL.content);
    await page.getByText('Ingest & Extract Snippets').click();

    await page.getByText('Random Snippet').click();
    await expect(page.getByText('Click here and start typing')).toBeVisible();
  });

  test('"← New material" from snippet browser returns to setup', async ({ page }) => {
    await page.route('**/materials', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(FAKE_MATERIAL) });
      } else {
        await route.continue();
      }
    });
    await page.route(`**/materials/${FAKE_MATERIAL.id}/process`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_SNIPPETS) }),
    );

    await openIngestTab(page);
    await page.getByPlaceholder(/Chapter 3/).fill(FAKE_MATERIAL.title);
    await page.getByPlaceholder(/Paste any text/i).fill(FAKE_MATERIAL.content);
    await page.getByText('Ingest & Extract Snippets').click();

    await page.getByText('← New material').click();
    await expect(page.getByText('AI Generate')).toBeVisible();
  });
});
