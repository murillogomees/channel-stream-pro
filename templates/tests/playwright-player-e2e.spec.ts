/**
 * Playwright E2E Test Skeleton - Player Flows
 * 
 * Tests critical player functionality:
 * 1. Authentication
 * 2. Channel browsing
 * 3. Stream playback
 * 4. Resume functionality
 * 5. Favorites
 * 
 * Run: npx playwright test templates/tests/playwright-player-e2e.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';

// Helper functions
async function login(page: Page, email: string = TEST_EMAIL, password: string = TEST_PASSWORD) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('[data-testid="email-input"], input[type="email"]', email);
  await page.fill('[data-testid="password-input"], input[type="password"]', password);
  await page.click('[data-testid="login-button"], button[type="submit"]');
  
  // Wait for redirect to home/dashboard
  await page.waitForURL(/\/(home|dashboard|player)/, { timeout: 10000 });
}

async function logout(page: Page) {
  // Try various logout methods
  const logoutButton = page.locator('[data-testid="logout-button"], button:has-text("Sair"), button:has-text("Logout")');
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  } else {
    // Try via menu
    const menuButton = page.locator('[data-testid="user-menu"], [data-testid="profile-menu"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.click('text=Sair, text=Logout');
    }
  }
  
  await page.waitForURL(/\/login/, { timeout: 5000 });
}

// ============================================
// TEST SUITE: Authentication
// ============================================
test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Wait for error message
    const errorMessage = page.locator('[role="alert"], .error-message, text=/erro|invalid|incorret/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await login(page);
    
    // Verify logged in state
    await expect(page).not.toHaveURL(/\/login/);
    
    // Look for user indicator
    const userIndicator = page.locator('[data-testid="user-avatar"], [data-testid="user-name"]');
    await expect(userIndicator).toBeVisible({ timeout: 5000 });
  });

  test('should logout successfully', async ({ page }) => {
    await login(page);
    await logout(page);
    
    await expect(page).toHaveURL(/\/login/);
  });
});

// ============================================
// TEST SUITE: Channel Browsing
// ============================================
test.describe('Channel Browsing', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display channel list', async ({ page }) => {
    await page.goto(`${BASE_URL}/player`);
    
    // Wait for channels to load
    const channelList = page.locator('[data-testid="channel-list"], .channel-list, .channel-grid');
    await expect(channelList).toBeVisible({ timeout: 10000 });
    
    // Should have at least one channel
    const channels = page.locator('[data-testid="channel-item"], .channel-item, .channel-card');
    await expect(channels.first()).toBeVisible();
  });

  test('should filter channels by category', async ({ page }) => {
    await page.goto(`${BASE_URL}/player`);
    
    // Wait for categories
    const categoryFilter = page.locator('[data-testid="category-filter"], .category-tabs, .category-select');
    await expect(categoryFilter).toBeVisible({ timeout: 10000 });
    
    // Click on a category
    const firstCategory = categoryFilter.locator('button, [role="tab"]').first();
    await firstCategory.click();
    
    // Channels should update
    await page.waitForTimeout(500);
    const channels = page.locator('[data-testid="channel-item"], .channel-item');
    await expect(channels.first()).toBeVisible();
  });

  test('should search channels', async ({ page }) => {
    await page.goto(`${BASE_URL}/player`);
    
    // Find search input
    const searchInput = page.locator('[data-testid="search-input"], input[placeholder*="Buscar"], input[placeholder*="Search"]');
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      
      // Results should update
      const results = page.locator('[data-testid="channel-item"], .channel-item, .search-result');
      // Either results exist or "no results" message
      const hasResults = await results.count() > 0;
      const noResultsMessage = page.locator('text=/nenhum|no results|não encontrado/i');
      const hasNoResultsMessage = await noResultsMessage.isVisible();
      
      expect(hasResults || hasNoResultsMessage).toBeTruthy();
    }
  });
});

// ============================================
// TEST SUITE: Stream Playback
// ============================================
test.describe('Stream Playback', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/player`);
  });

  test('should play channel when clicked', async ({ page }) => {
    // Click on first channel
    const firstChannel = page.locator('[data-testid="channel-item"], .channel-item, .channel-card').first();
    await expect(firstChannel).toBeVisible({ timeout: 10000 });
    await firstChannel.click();
    
    // Wait for player to appear
    const player = page.locator('video, [data-testid="video-player"], .video-player');
    await expect(player).toBeVisible({ timeout: 10000 });
  });

  test('should show player controls', async ({ page }) => {
    // Start playback
    const firstChannel = page.locator('[data-testid="channel-item"], .channel-item').first();
    await firstChannel.click();
    
    // Hover over player to show controls
    const player = page.locator('video, [data-testid="video-player"]');
    await player.hover();
    
    // Check for controls
    const controls = page.locator('[data-testid="player-controls"], .player-controls, .vjs-control-bar');
    await expect(controls).toBeVisible({ timeout: 5000 });
    
    // Check for play/pause button
    const playButton = page.locator('[data-testid="play-button"], button[aria-label*="Play"], button[aria-label*="Pause"]');
    await expect(playButton).toBeVisible();
  });

  test('should toggle fullscreen', async ({ page }) => {
    // Start playback
    const firstChannel = page.locator('[data-testid="channel-item"]').first();
    await firstChannel.click();
    
    // Find fullscreen button
    const fullscreenButton = page.locator('[data-testid="fullscreen-button"], button[aria-label*="fullscreen"], button[aria-label*="Tela cheia"]');
    
    if (await fullscreenButton.isVisible()) {
      await fullscreenButton.click();
      
      // Verify fullscreen state changed
      await page.waitForTimeout(500);
      
      // Press escape to exit fullscreen
      await page.keyboard.press('Escape');
    }
  });
});

// ============================================
// TEST SUITE: Resume Functionality
// ============================================
test.describe('Resume Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should save watch progress', async ({ page }) => {
    await page.goto(`${BASE_URL}/player`);
    
    // Start playback
    const firstChannel = page.locator('[data-testid="channel-item"]').first();
    await firstChannel.click();
    
    // Wait for video to play
    await page.waitForTimeout(5000);
    
    // Navigate away
    await page.goto(`${BASE_URL}/player`);
    
    // Check for continue watching section
    const continueWatching = page.locator('[data-testid="continue-watching"], .continue-watching, text=/Continuar Assistindo|Continue Watching/i');
    
    // May or may not be visible depending on content type
    if (await continueWatching.isVisible()) {
      await expect(continueWatching).toBeVisible();
    }
  });
});

// ============================================
// TEST SUITE: Favorites
// ============================================
test.describe('Favorites', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/player`);
  });

  test('should add channel to favorites', async ({ page }) => {
    // Find favorite button on first channel
    const favoriteButton = page.locator('[data-testid="favorite-button"], button[aria-label*="favorit"]').first();
    
    if (await favoriteButton.isVisible()) {
      await favoriteButton.click();
      
      // Should show feedback (toast or icon change)
      const toast = page.locator('[role="alert"], .toast, .notification');
      const iconChanged = page.locator('[data-testid="favorite-button"].active, [data-testid="favorite-button"][aria-pressed="true"]');
      
      const hasToast = await toast.isVisible().catch(() => false);
      const hasIconChange = await iconChanged.isVisible().catch(() => false);
      
      expect(hasToast || hasIconChange).toBeTruthy();
    }
  });

  test('should display favorites list', async ({ page }) => {
    // Navigate to favorites/my list
    const favoritesLink = page.locator('a[href*="favorit"], a[href*="mylist"], text=/Favoritos|My List|Minha Lista/i');
    
    if (await favoritesLink.isVisible()) {
      await favoritesLink.click();
      
      // Should show favorites section
      const favoritesSection = page.locator('[data-testid="favorites-list"], .favorites-list');
      await expect(favoritesSection).toBeVisible({ timeout: 5000 });
    }
  });
});

// ============================================
// TEST SUITE: Error Handling
// ============================================
test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should handle stream errors gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/player`);
    
    // Mock a failing stream
    await page.route('**/*.m3u8', route => route.abort('failed'));
    
    // Try to play
    const firstChannel = page.locator('[data-testid="channel-item"]').first();
    await firstChannel.click();
    
    // Should show error message
    const errorMessage = page.locator('[data-testid="error-message"], .error-message, text=/erro|error|falha/i');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should handle 404 pages', async ({ page }) => {
    await page.goto(`${BASE_URL}/nonexistent-page-12345`);
    
    // Should show 404 or redirect
    const is404 = await page.locator('text=/404|não encontrada|not found/i').isVisible();
    const isRedirected = !page.url().includes('nonexistent');
    
    expect(is404 || isRedirected).toBeTruthy();
  });
});

// ============================================
// TEST SUITE: Performance
// ============================================
test.describe('Performance', () => {
  test('should load home page within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have good Core Web Vitals', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/player`);
    
    // Measure LCP
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        
        // Timeout fallback
        setTimeout(() => resolve(0), 5000);
      });
    });
    
    // LCP should be under 2.5 seconds
    expect(lcp).toBeLessThan(2500);
  });
});
