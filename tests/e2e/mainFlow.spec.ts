import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

const AIR_CANADA_FIXTURE = readFileSync(
  join(process.cwd(), 'tests/fixtures/emails/flight_air_canada.txt'),
  'utf8',
);

test.describe('main flow', () => {
  test('onboarding → parse email → dashboard → gap alert', async ({ page }) => {
    // 1. Onboarding
    await page.goto('/onboarding');
    await expect(page).toHaveTitle(/Roamly/);
    await page.getByRole('button', { name: /get started/i }).click();
    await page.getByRole('button', { name: /understood/i }).click();
    await page.getByRole('button', { name: /local only/i }).click();
    await page.getByRole('button', { name: /start fresh/i }).click();
    await page.waitForURL('/');

    // 2. Navigate to parse page
    await page.goto('/add/parse');
    await expect(page.getByText(/paste & parse/i)).toBeVisible();

    // 3. Paste the Air Canada fixture email
    const textarea = page.getByPlaceholder(/paste email text here/i);
    await textarea.fill(AIR_CANADA_FIXTURE);

    // 4. Click Parse
    await page.getByRole('button', { name: /^parse$/i }).click();

    // 5. Wait for preview and verify at least one event was detected
    await expect(page.getByText(/event.*detected/i)).toBeVisible({ timeout: 10_000 });

    // 6. Save to trip
    await page.getByRole('button', { name: /save to trip/i }).click();
    await page.waitForURL(/\/trips\/.+/, { timeout: 10_000 });

    // 7. Navigate to dashboard and verify TimelineCard appeared
    await page.goto('/');
    // The Air Canada flight creates an event — timeline or trip card should be visible
    await expect(page.locator('[data-testid="timeline-card"], .timeline-card').first().or(
      page.getByText(/AC 123|Tokyo|Air Canada/i).first()
    )).toBeVisible({ timeout: 10_000 });

    // 8. Verify GapAlert for missing accommodation (flight arrives without hotel)
    await expect(
      page.getByText(/missing accommodation|no accommodation/i).first().or(
        page.locator('[data-testid="gap-alert"]').first()
      )
    ).toBeVisible({ timeout: 10_000 });
  });

  test('title check', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Roamly/);
  });
});
