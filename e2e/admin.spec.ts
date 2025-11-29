/**
 * E2E Tests - Admin Dashboard
 * 
 * Testes end-to-end para validar fluxos do painel administrativo
 * Execute com: npx playwright test e2e/admin.spec.ts
 */

// @ts-nocheck - These tests run in Playwright context, not the app build
import { test, expect, Page } from '@playwright/test';

// ========================================
// Test Configuration
// ========================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test123';

// ========================================
// Helper Functions
// ========================================

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

// ========================================
// Admin Hub Tests
// ========================================

test.describe('Admin Hub', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should load admin hub page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await waitForPageLoad(page);
    
    await expect(page.locator('h1')).toContainText('Admin Hub');
    await expect(page.locator('[data-testid="category-card"]')).toHaveCount(6);
  });

  test('should search for functions', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await waitForPageLoad(page);
    
    await page.fill('input[placeholder*="Buscar"]', 'M3U');
    await expect(page.locator('[data-testid="category-card"]')).toBeVisible();
  });

  test('should navigate to M3U management', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await waitForPageLoad(page);
    
    await page.click('text=Gestão M3U');
    await expect(page).toHaveURL(`${BASE_URL}/admin/m3u`);
  });
});

// ========================================
// M3U Management Tests
// ========================================

test.describe('M3U Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should load M3U management page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/m3u`);
    await waitForPageLoad(page);
    
    await expect(page.locator('h1')).toContainText('Gestão de M3U');
    await expect(page.locator('[role="tablist"]')).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/m3u`);
    await waitForPageLoad(page);
    
    await page.click('button:has-text("Builder")');
    await waitForPageLoad(page);
    
    await expect(page.locator('[role="tabpanel"]')).toBeVisible();
  });
});

// ========================================
// Security Management Tests
// ========================================

test.describe('Security Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should load security page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/security`);
    await waitForPageLoad(page);
    
    await expect(page.locator('h1')).toContainText('Segurança');
  });

  test('should show security alerts tab', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/security`);
    await waitForPageLoad(page);
    
    await page.click('button:has-text("Alertas")');
    await expect(page.locator('[role="tabpanel"]')).toBeVisible();
  });
});

// ========================================
// Notifications Management Tests
// ========================================

test.describe('Notifications Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should load notifications page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/notifications`);
    await waitForPageLoad(page);
    
    await expect(page.locator('h1')).toContainText('Notificações');
  });
});

// ========================================
// Analytics Hub Tests
// ========================================

test.describe('Analytics Hub', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should load analytics page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/analytics`);
    await waitForPageLoad(page);
    
    await expect(page.locator('h1')).toContainText('Analytics');
  });

  test('should show conversion tab', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/analytics`);
    await waitForPageLoad(page);
    
    await page.click('button:has-text("Conversão")');
    await expect(page.locator('[role="tabpanel"]')).toBeVisible();
  });
});

// ========================================
// Legacy Route Redirect Tests
// ========================================

test.describe('Legacy Route Redirects', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should redirect /admin/m3u-lists to /admin/m3u', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/m3u-lists`);
    await expect(page).toHaveURL(`${BASE_URL}/admin/m3u`);
  });

  test('should redirect /admin/notificacoes to /admin/notifications', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/notificacoes`);
    await expect(page).toHaveURL(`${BASE_URL}/admin/notifications`);
  });

  test('should redirect /admin/security-alerts to /admin/security', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/security-alerts`);
    await expect(page).toHaveURL(`${BASE_URL}/admin/security`);
  });

  test('should redirect /admin/conversion-dashboard to /admin/analytics', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/conversion-dashboard`);
    await expect(page).toHaveURL(`${BASE_URL}/admin/analytics`);
  });

  test('should redirect /admin/system-health to /admin/system', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/system-health`);
    await expect(page).toHaveURL(`${BASE_URL}/admin/system`);
  });

  test('should redirect /admin/user-roles to /admin/users', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/user-roles`);
    await expect(page).toHaveURL(`${BASE_URL}/admin/users`);
  });
});

// ========================================
// Access Control Tests
// ========================================

test.describe('Access Control', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await expect(page).toHaveURL(/login/);
  });
});
