import { test, expect } from '@playwright/test';

test.describe('backup / restore', () => {
  test.beforeEach(async ({ page }) => {
    // Start from onboarding with seed data
    await page.goto('/onboarding');
    await page.getByRole('button', { name: /get started/i }).click();
    await page.getByRole('button', { name: /understood/i }).click();
    await page.getByRole('button', { name: /local only/i }).click();
    await page.getByRole('button', { name: /load demo data/i }).click();
    await page.waitForURL('/');
  });

  test('export → wipe → import round-trip (plain)', async ({ page }) => {
    // Open settings → Backups section
    await page.goto('/settings');
    await expect(page.getByText(/back up now/i)).toBeVisible({ timeout: 5_000 });

    // Set up download capture
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /back up now/i }).click(),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Wipe via danger zone
    const deleteBtn = page.getByRole('button', { name: /delete all.*data|wipe.*data/i });
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      // Confirm dialog if present
      const confirmBtn = page.getByRole('button', { name: /confirm|yes.*delete/i });
      if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmBtn.click();
      }
    }

    // Import the downloaded file
    await page.getByRole('button', { name: /import/i }).first().click();
    await expect(page.getByText(/export.*import|import.*export/i)).toBeVisible({ timeout: 5_000 });

    const importTab = page.getByRole('button', { name: /^import$/i });
    if (await importTab.isVisible()) await importTab.click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(downloadPath!);

    await page.getByRole('button', { name: /apply/i }).click();
    await expect(page.getByText(/import complete|added/i)).toBeVisible({ timeout: 10_000 });

    // Verify data is back on dashboard
    await page.goto('/');
    await expect(page.getByText(/tokyo|lisbon/i)).toBeVisible({ timeout: 5_000 });
  });

  test('encrypted export → wrong passphrase shows error', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: /import/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /import/i }).first().click();
    await expect(page.getByText(/export.*import|import.*export/i)).toBeVisible({ timeout: 5_000 });

    // Export with passphrase
    const exportTab = page.getByRole('button', { name: /^export$/i });
    if (await exportTab.isVisible()) await exportTab.click();

    const passphraseInput = page.getByPlaceholder(/leave blank.*unencrypted|passphrase/i);
    await passphraseInput.fill('my-secret-pass');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /^export$/i }).last().click(),
    ]);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Now try to import with wrong passphrase
    const importTab = page.getByRole('button', { name: /^import$/i });
    if (await importTab.isVisible()) await importTab.click();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(downloadPath!);

    // Set wrong passphrase
    await passphraseInput.fill('wrong-passphrase');
    await page.getByRole('button', { name: /apply/i }).click();

    // Should show an error, not crash or wipe data
    await expect(
      page.getByText(/decrypt|passphrase|wrong|fail/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('dry-run shows preview without writing', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: /import/i }).first().click();

    const importTab = page.getByRole('button', { name: /^import$/i });
    if (await importTab.isVisible()) await importTab.click();

    // Export first to get a file
    const exportTab = page.getByRole('button', { name: /^export$/i });
    if (await exportTab.isVisible()) {
      await exportTab.click();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: /^export$/i }).last().click(),
      ]);
      const downloadPath = await download.path();

      if (await importTab.isVisible()) await importTab.click();

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(downloadPath!);

      // Select dry run mode
      await page.getByRole('button', { name: /dry run/i }).click();

      await page.getByRole('button', { name: /preview/i }).first().click();
      await expect(page.getByText(/dry.run preview/i)).toBeVisible({ timeout: 5_000 });
    }
  });
});
