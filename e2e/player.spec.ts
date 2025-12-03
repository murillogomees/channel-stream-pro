import { test, expect } from '@playwright/test';

test.describe('Player Page (requires auth)', () => {
  test('should redirect to login if not authenticated', async ({ page }) => {
    await page.goto('/app/player');
    await expect(page).toHaveURL(/login/);
  });

  test.skip('should load player when authenticated', async ({ page }) => {
    // This test requires authentication setup
    // Skip for now, implement with auth fixtures
    await page.goto('/app/player');
    await expect(page.locator('video, .player-container')).toBeVisible();
  });
});
