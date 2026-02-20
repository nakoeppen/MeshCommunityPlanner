/**
 * Playwright integration tests for the elevation heatmap UI.
 * Runs against the live dev server — no SRTM data needed.
 */

import { test, expect } from '@playwright/test';

test.describe('Elevation Heatmap', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForSelector('.toolbar');
  });

  async function openToolsMenu(page: import('@playwright/test').Page) {
    const toolsBtn = page.locator('.toolbar-menu-btn', { hasText: 'Tools' });
    await toolsBtn.click();
    await page.waitForSelector('.toolbar-dropdown');
  }

  test('Tools dropdown contains "Elevation Heatmap" item', async ({ page }) => {
    await openToolsMenu(page);
    const item = page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' });
    await expect(item).toBeVisible();
  });

  test('clicking toggle on shows the elevation legend', async ({ page }) => {
    await openToolsMenu(page);
    const item = page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' });
    await item.click();

    const legend = page.locator('.elevation-legend');
    await expect(legend).toBeVisible();
    await expect(legend.locator('.elevation-legend-title')).toHaveText('Elevation');
  });

  test('clicking toggle off hides the elevation legend', async ({ page }) => {
    // Toggle on
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();
    await expect(page.locator('.elevation-legend')).toBeVisible();

    // Toggle off
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();
    await expect(page.locator('.elevation-legend')).not.toBeVisible();
  });

  test('opacity slider is interactive', async ({ page }) => {
    // Enable elevation
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const slider = page.locator('.elevation-legend-slider input[type="range"]');
    await expect(slider).toBeVisible();

    // Change slider value
    await slider.fill('0.3');
    await expect(slider).toHaveValue('0.3');
  });

  test('checkmark appears when enabled, disappears when disabled', async ({ page }) => {
    // Enable
    await openToolsMenu(page);
    let item = page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' });
    await item.click();

    // Reopen and check for checkmark
    await openToolsMenu(page);
    item = page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' });
    await expect(item).toContainText('\u2713');

    // Disable
    await item.click();

    // Reopen and verify no checkmark
    await openToolsMenu(page);
    item = page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' });
    const text = await item.textContent();
    expect(text).not.toContain('\u2713');
  });

  test('elevation heatmap button has title attribute', async ({ page }) => {
    await openToolsMenu(page);
    const item = page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' });
    await expect(item).toHaveAttribute('title');
  });
});
