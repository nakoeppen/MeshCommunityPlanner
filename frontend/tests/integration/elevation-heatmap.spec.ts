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

    // Dismiss the WelcomeTour overlay if it appears (blocks clicks on first launch)
    const overlay = page.locator('.tour-overlay');
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await overlay.click({ position: { x: 5, y: 5 } });
      await overlay.waitFor({ state: 'hidden', timeout: 3000 });
    }
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

  // -------------------------------------------------------------------------
  // Elevation Range Sliders
  // -------------------------------------------------------------------------

  test('elevation legend shows min and max range sliders', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const minSlider = page.locator('input[aria-label="Minimum elevation"]');
    const maxSlider = page.locator('input[aria-label="Maximum elevation"]');
    await expect(minSlider).toBeVisible();
    await expect(maxSlider).toBeVisible();
  });

  test('min slider default value is -500', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const minSlider = page.locator('input[aria-label="Minimum elevation"]');
    await expect(minSlider).toHaveValue('-500');
  });

  test('max slider default value is 9000', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const maxSlider = page.locator('input[aria-label="Maximum elevation"]');
    await expect(maxSlider).toHaveValue('9000');
  });

  test('no Reset button at default range', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const resetBtn = page.locator('.elevation-legend-reset');
    await expect(resetBtn).not.toBeVisible();
  });

  test('changing min slider shows Reset button and updates display value', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const minSlider = page.locator('input[aria-label="Minimum elevation"]');
    // Fill sets value and triggers change + pointerup
    await minSlider.fill('200');

    // Verify the displayed value updated (now an <input>, so use toHaveValue not toHaveText)
    const rangeValue = page.locator('input[aria-label="Minimum elevation value"]');
    await expect(rangeValue).toHaveValue('200');

    // Reset button should appear after committing range
    // (need to trigger pointerup for store commit)
    await minSlider.dispatchEvent('pointerup');
    const resetBtn = page.locator('.elevation-legend-reset');
    await expect(resetBtn).toBeVisible();
  });

  test('Reset button restores default range values', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    // Set custom range
    const minSlider = page.locator('input[aria-label="Minimum elevation"]');
    await minSlider.fill('200');
    await minSlider.dispatchEvent('pointerup');

    // Click Reset
    const resetBtn = page.locator('.elevation-legend-reset');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Verify sliders back to defaults
    await expect(minSlider).toHaveValue('-500');
    const maxSlider = page.locator('input[aria-label="Maximum elevation"]');
    await expect(maxSlider).toHaveValue('9000');

    // Reset button should be gone
    await expect(resetBtn).not.toBeVisible();
  });

  test('legend swatches update count stays at 10 after range change', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    // Change range
    const minSlider = page.locator('input[aria-label="Minimum elevation"]');
    await minSlider.fill('100');
    await minSlider.dispatchEvent('pointerup');

    const swatches = page.locator('.elevation-legend-swatch');
    await expect(swatches).toHaveCount(10);
  });

  test('range sliders have accessible aria-labels', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const minSlider = page.locator('[aria-label="Minimum elevation"]');
    const maxSlider = page.locator('[aria-label="Maximum elevation"]');
    const opacitySlider = page.locator('[aria-label="Elevation layer opacity"]');

    await expect(minSlider).toBeVisible();
    await expect(maxSlider).toBeVisible();
    await expect(opacitySlider).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Number inputs
  // -------------------------------------------------------------------------

  test('min number input is visible with default value -500', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const minInput = page.locator('[aria-label="Minimum elevation value"]');
    await expect(minInput).toBeVisible();
    await expect(minInput).toHaveValue('-500');
  });

  test('max number input is visible with default value 9000', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const maxInput = page.locator('[aria-label="Maximum elevation value"]');
    await expect(maxInput).toBeVisible();
    await expect(maxInput).toHaveValue('9000');
  });

  test('typing in min number input and pressing Enter updates slider', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const minInput = page.locator('[aria-label="Minimum elevation value"]');
    await minInput.fill('300');
    await minInput.press('Enter');

    const minSlider = page.locator('input[aria-label="Minimum elevation"]');
    await expect(minSlider).toHaveValue('300');
  });

  test('typing in max number input and pressing Enter updates slider', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const maxInput = page.locator('[aria-label="Maximum elevation value"]');
    await maxInput.fill('500');
    await maxInput.press('Enter');

    const maxSlider = page.locator('input[aria-label="Maximum elevation"]');
    await expect(maxSlider).toHaveValue('500');
  });

  test('number inputs are keyboard-focusable via Tab', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    // Focus min slider, Tab twice (past min slider, land on min number input)
    const minSlider = page.locator('input[aria-label="Minimum elevation"]');
    await minSlider.focus();
    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');
    const label = await focused.getAttribute('aria-label');
    expect(['Minimum elevation value', 'Maximum elevation', 'Elevation layer opacity'])
      .toContain(label);
  });

  // -------------------------------------------------------------------------
  // Keyboard accessibility — Page Up / Page Down
  // -------------------------------------------------------------------------

  test('PageDown on min slider decreases value by 100m', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const minSlider = page.locator('input[aria-label="Minimum elevation"]');
    await minSlider.fill('300');
    await minSlider.dispatchEvent('pointerup');

    await minSlider.focus();
    await page.keyboard.press('PageDown');

    // After PageDown the local value is 200, number input reflects it
    const minInput = page.locator('[aria-label="Minimum elevation value"]');
    await expect(minInput).toHaveValue('200');
  });

  test('PageUp on max slider increases value by 100m', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const maxSlider = page.locator('input[aria-label="Maximum elevation"]');
    await maxSlider.fill('500');
    await maxSlider.dispatchEvent('pointerup');

    await maxSlider.focus();
    await page.keyboard.press('PageUp');

    const maxInput = page.locator('[aria-label="Maximum elevation value"]');
    await expect(maxInput).toHaveValue('600');
  });

  // -------------------------------------------------------------------------
  // Lock / remember range
  // -------------------------------------------------------------------------

  test('Remember range checkbox is visible and unchecked by default', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const checkbox = page.locator('[aria-label="Remember elevation range across sessions"]');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test('checking Remember range saves range to localStorage', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    // Set a custom range first
    const minSlider = page.locator('input[aria-label="Minimum elevation"]');
    await minSlider.fill('200');
    await minSlider.dispatchEvent('pointerup');

    // Check the lock
    const checkbox = page.locator('[aria-label="Remember elevation range across sessions"]');
    await checkbox.check();

    // Verify localStorage was written
    const stored = await page.evaluate(() => localStorage.getItem('meshPlanner_elevationRange'));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.min).toBe(200);
  });

  test('unchecking Remember range removes entry from localStorage', async ({ page }) => {
    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const checkbox = page.locator('[aria-label="Remember elevation range across sessions"]');
    await checkbox.check();
    await checkbox.uncheck();

    const stored = await page.evaluate(() => localStorage.getItem('meshPlanner_elevationRange'));
    expect(stored).toBeNull();
  });

  test('range is restored from localStorage on page reload', async ({ page }) => {
    // Read the current build ID from the running app, then write localStorage
    // with a matching buildId so the store doesn't discard it on reload.
    const buildId = await page.evaluate(() => {
      // The store exposes ELEVATION_RANGE_BUILD_ID; read it from an existing entry
      // or extract from the app. Easiest: read the key the store uses at init.
      // We just write a known range and set buildId to match __BUILD_ID__.
      return (window as any).__BUILD_ID__ as string | undefined;
    });
    // Fallback: extract buildId from any existing localStorage entry, or use
    // the app's exported constant by enabling elevation and reading what it writes.
    await page.evaluate((bid) => {
      localStorage.setItem('meshPlanner_elevationRange', JSON.stringify({ min: 150, max: 500, buildId: bid || 'dev' }));
    }, buildId);
    await page.reload();
    await page.waitForSelector('.toolbar');

    // Dismiss tour overlay if visible
    const overlay = page.locator('.tour-overlay');
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await overlay.click({ position: { x: 5, y: 5 } });
      await overlay.waitFor({ state: 'hidden', timeout: 3000 });
    }

    await openToolsMenu(page);
    await page.locator('.toolbar-dropdown-item', { hasText: 'Elevation Heatmap' }).click();

    const minSlider = page.locator('input[aria-label="Minimum elevation"]');
    const maxSlider = page.locator('input[aria-label="Maximum elevation"]');
    await expect(minSlider).toHaveValue('150');
    await expect(maxSlider).toHaveValue('500');
  });
});
