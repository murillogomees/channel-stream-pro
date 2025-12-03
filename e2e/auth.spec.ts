import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/IPTVLink/);
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
  });

  test('should show validation errors on empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page.getByText(/email.*obrigatório/i)).toBeVisible();
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.goto('/login');
    await page.getByText(/cadastrar/i).click();
    await expect(page).toHaveURL(/signup/);
  });

  test('should redirect unauthenticated users from admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/login/);
  });
});
