import { test, expect } from '@playwright/test';

test.describe('Public Navigation', () => {
  test('should load homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/IPTVLink/);
  });

  test('should have responsive navigation', async ({ page }) => {
    await page.goto('/');
    
    // Desktop: navigation visible
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole('navigation')).toBeVisible();
    
    // Mobile: hamburger menu
    await page.setViewportSize({ width: 375, height: 667 });
    const mobileMenu = page.getByRole('button', { name: /menu/i });
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      await expect(page.getByRole('navigation')).toBeVisible();
    }
  });

  test('should navigate to pricing', async ({ page }) => {
    await page.goto('/');
    const pricingLink = page.getByRole('link', { name: /preços|planos/i });
    if (await pricingLink.isVisible()) {
      await pricingLink.click();
      await expect(page).toHaveURL(/pricing|planos/);
    }
  });
});
