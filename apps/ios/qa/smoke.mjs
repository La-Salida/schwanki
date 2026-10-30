import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

// Export the web preview and serve dist first. This exercises shared UI only;
// native auth, SQLite, Files, audio and notification acceptance runs on iPhone.
const out = resolve(process.env.SCREENSHOT_DIR || 'qa/output');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
  args: ['--no-sandbox'],
});
const errors = [];
const logs = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.getByTestId('import-deck').waitFor();
  await page.screenshot({ path: `${out}/entry.png` });
  const horizontalOverflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(await horizontalOverflow(), false);
  await page.getByRole('button', { name: 'How do I export from Anki?' }).click();
  assert.equal(await page.getByText('From AnkiMobile', { exact: true }).count(), 1);
  await page.getByRole('button', { name: 'How do I export from Anki?' }).click();
  await page.getByRole('button', { name: 'Turn notes into cards on the web', exact: true }).click();
  await page.getByText('Same words.').waitFor();
  await page.screenshot({ path: `${out}/web-handoff.png` });
  await page.getByRole('button', { name: 'Close sheet' }).click();
  await page.getByRole('button', { name: 'Close sheet' }).waitFor({ state: 'hidden' });
  await page.getByText('Coming soon:', { exact: false }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/entry-notes.png` });
  await page.getByTestId('sample-feed').click();
  await page.getByTestId('reveal-card').waitFor();
  assert.equal(await page.getByTestId('rate-good').getAttribute('aria-disabled'), 'true');
  await page.screenshot({ path: `${out}/feed-hidden.png` });
  // Headless Linux has no Spanish speech voice. Muting prevents unsupported
  // autoplay and leaves this capture focused on revealed-card layout.
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
  await page.getByTestId('reveal-card').click();
  await page.getByRole('button', { name: 'Play audio', exact: true }).waitFor();
  assert.notEqual(await page.getByTestId('rate-good').getAttribute('aria-disabled'), 'true');
  await page.screenshot({ path: `${out}/feed-revealed.png` });
  for (const rating of ['good', 'again', 'easy']) {
    if (rating !== 'good') await page.getByTestId('reveal-card').click();
    await page.getByTestId(`rate-${rating}`).click();
  }
  await page.getByText('Three sample cards. Your words can feel like this too.').waitFor();
  await page.screenshot({ path: `${out}/sample-complete.png` });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByTestId('import-deck').click();
  await page.getByText('Sign-in is not available in this build.', { exact: false }).waitFor();
  logs.push('Unconfigured sign-in reports a useful error without losing entry/sample navigation.');
  await page.reload({ waitUntil: 'networkidle' });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByTestId('sample-feed').click();
  await page.getByTestId('reveal-card').click();
  const rating = await page.getByTestId('rate-good').boundingBox();
  assert.ok(rating && rating.y + rating.height <= 667 && rating.height >= 44);
  assert.equal(await horizontalOverflow(), false);
  await page.screenshot({ path: `${out}/feed-small.png` });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, viewport: '390×844 + 375×667', screenshots: out, errors, notes: logs }, null, 2));
} finally { await browser.close(); }
