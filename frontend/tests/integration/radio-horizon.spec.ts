/**
 * Playwright integration tests for the radio horizon collapsible note
 * and "Set to X km" button in the coverage panel.
 *
 * Follows the same pattern as coverage-settings.spec.ts.
 * The coverage panel lives in the sidebar under the Plan section when a plan
 * is open and a node exists. We seed the required state via the backend API.
 */

import { test, expect } from '@playwright/test';

test.describe('Radio Horizon UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.toolbar');

    // Dismiss the WelcomeTour overlay if it appears
    const overlay = page.locator('.tour-overlay');
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await overlay.click({ position: { x: 5, y: 5 } });
      await overlay.waitFor({ state: 'hidden', timeout: 3000 });
    }

    // Clear coverage settings so tests run with default 15 km radius
    await page.evaluate(() => localStorage.removeItem('meshPlanner_coverageSettings'));
  });

  // ---- Helper: create a plan + node via toolbar actions so coverage settings are visible ----

  async function setupPlanWithNode(
    page: import('@playwright/test').Page,
    antennaHeightM = 3
  ) {
    // Create a new plan via Plan → New Plan
    const planBtn = page.locator('.toolbar-menu-btn', { hasText: 'Plan' });
    await planBtn.click();
    await page.waitForSelector('.toolbar-dropdown');
    await page.locator('.toolbar-dropdown-item', { hasText: 'New Plan' }).click();

    // Wait for any plan-name dialog / prompt and confirm default name
    const promptOk = page.locator('.prompt-dialog-ok, .confirm-dialog-ok');
    if (await promptOk.isVisible({ timeout: 2000 }).catch(() => false)) {
      await promptOk.click();
    }

    // Wait for plan to load — sidebar should appear
    await page.waitForSelector('.app-sidebar', { timeout: 10000 });

    // Enter add-node mode: click the map in add_node mode.
    // The toolbar "Add Node" button (if it exists) or switch mode via map click.
    // The sidebar "Add Node" mode is toggled by clicking the map button:
    const addNodeBtn = page.locator('[title*="Add Node"], [title*="add node"], .sidebar-btn', { hasText: /add node/i }).first();
    if (await addNodeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addNodeBtn.click();
    }

    // Create a node by clicking the map canvas
    const mapContainer = page.locator('#map, .leaflet-container, .app-map').first();
    await mapContainer.click({ position: { x: 400, y: 300 } });

    // Wait for a node to appear in the sidebar or node list
    await page.waitForFunction(
      () => document.querySelectorAll('.node-list-item, .node-row, [data-node-id]').length > 0,
      { timeout: 8000 }
    ).catch(() => {
      // Node creation may behave differently — continue anyway
    });

    // If antenna height needs to be set to trigger beyond-horizon, update it.
    // Find the antenna height input in the sidebar
    if (antennaHeightM !== 3) {
      const antennaInput = page.locator('#antennaHeight, input[aria-label*="antenna height" i], input[title*="antenna height" i]').first();
      if (await antennaInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await antennaInput.fill(String(antennaHeightM));
        await antennaInput.press('Enter');
      }
    }
  }

  // ---- Radio horizon collapsible ----

  test('horizon-note <details> element exists in coverage panel', async ({ page }) => {
    await setupPlanWithNode(page);
    const details = page.locator('details.horizon-note');
    await expect(details).toBeVisible({ timeout: 8000 });
  });

  test('summary text "Note: Radio Horizon" is visible', async ({ page }) => {
    await setupPlanWithNode(page);
    await page.locator('details.horizon-note').waitFor({ state: 'visible', timeout: 8000 });
    const summary = page.locator('details.horizon-note summary');
    await expect(summary).toContainText('Note: Radio Horizon');
  });

  test('details element is closed by default (not open)', async ({ page }) => {
    await setupPlanWithNode(page);
    const details = page.locator('details.horizon-note');
    await details.waitFor({ state: 'visible', timeout: 8000 });
    // The `open` attribute should not be present
    const hasOpen = await details.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpen).toBe(false);
  });

  test('clicking summary opens the details (body text visible)', async ({ page }) => {
    await setupPlanWithNode(page);
    const details = page.locator('details.horizon-note');
    await details.waitFor({ state: 'visible', timeout: 8000 });
    const summary = details.locator('summary');
    await summary.click();
    const body = details.locator('.horizon-note-body');
    await expect(body).toBeVisible();
  });

  test('clicking summary again closes the details', async ({ page }) => {
    await setupPlanWithNode(page);
    const details = page.locator('details.horizon-note');
    await details.waitFor({ state: 'visible', timeout: 8000 });
    const summary = details.locator('summary');
    // Open
    await summary.click();
    await expect(details.locator('.horizon-note-body')).toBeVisible();
    // Close
    await summary.click();
    const hasOpen = await details.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpen).toBe(false);
  });

  test('body text contains "Earth curvature"', async ({ page }) => {
    await setupPlanWithNode(page);
    const details = page.locator('details.horizon-note');
    await details.waitFor({ state: 'visible', timeout: 8000 });
    await details.locator('summary').click();
    const body = details.locator('.horizon-note-body');
    await expect(body).toContainText('Earth curvature');
  });

  test('summary is keyboard accessible — Tab to focus, Enter to toggle', async ({ page }) => {
    await setupPlanWithNode(page);
    const details = page.locator('details.horizon-note');
    await details.waitFor({ state: 'visible', timeout: 8000 });
    const summary = details.locator('summary');
    await summary.focus();
    await expect(summary).toBeFocused();
    // Enter should toggle open
    await page.keyboard.press('Enter');
    const hasOpen = await details.evaluate((el) => el.hasAttribute('open'));
    expect(hasOpen).toBe(true);
  });

  // ---- "Set to X km" button ----

  test('.horizon-set-btn is visible when max radius exceeds radio horizon', async ({ page }) => {
    // Antenna height 3m → horizon ≈ 3570*(sqrt(3)+sqrt(1.5)) ≈ 10.6 km
    // Set max radius to 30 km (beyond horizon) via localStorage pre-seed
    await page.evaluate(() =>
      localStorage.setItem('meshPlanner_coverageSettings', JSON.stringify({ maxRadiusKm: 30, env: 'suburban' }))
    );
    await page.reload();
    await page.waitForSelector('.toolbar');
    const tourOverlay = page.locator('.tour-overlay');
    if (await tourOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tourOverlay.click({ position: { x: 5, y: 5 } });
      await tourOverlay.waitFor({ state: 'hidden', timeout: 3000 });
    }

    await setupPlanWithNode(page, 3);

    // Ensure the max radius input shows 30
    const input = page.locator('#maxRadiusKm');
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill('30');
      await input.press('Tab');
    }

    const setBtn = page.locator('.horizon-set-btn');
    await expect(setBtn).toBeVisible({ timeout: 8000 });
  });

  test('.horizon-set-btn has aria-label containing "Set max radius"', async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem('meshPlanner_coverageSettings', JSON.stringify({ maxRadiusKm: 30, env: 'suburban' }))
    );
    await page.reload();
    await page.waitForSelector('.toolbar');
    const tourOverlay = page.locator('.tour-overlay');
    if (await tourOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tourOverlay.click({ position: { x: 5, y: 5 } });
      await tourOverlay.waitFor({ state: 'hidden', timeout: 3000 });
    }

    await setupPlanWithNode(page, 3);

    const input = page.locator('#maxRadiusKm');
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill('30');
      await input.press('Tab');
    }

    const setBtn = page.locator('.horizon-set-btn');
    await setBtn.waitFor({ state: 'visible', timeout: 8000 });
    const label = await setBtn.getAttribute('aria-label');
    expect(label).toContain('Set max radius');
  });

  test('clicking .horizon-set-btn changes max radius input to horizon value', async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem('meshPlanner_coverageSettings', JSON.stringify({ maxRadiusKm: 30, env: 'suburban' }))
    );
    await page.reload();
    await page.waitForSelector('.toolbar');
    const tourOverlay = page.locator('.tour-overlay');
    if (await tourOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tourOverlay.click({ position: { x: 5, y: 5 } });
      await tourOverlay.waitFor({ state: 'hidden', timeout: 3000 });
    }

    await setupPlanWithNode(page, 3);

    const input = page.locator('#maxRadiusKm');
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill('30');
      await input.press('Tab');
    }

    const setBtn = page.locator('.horizon-set-btn');
    await setBtn.waitFor({ state: 'visible', timeout: 8000 });

    // Read the text of the button to get the target value ("Set to X km")
    const btnText = await setBtn.textContent();
    const match = btnText?.match(/Set to (\d+) km/);
    const targetKm = match ? match[1] : null;

    await setBtn.click();

    if (targetKm) {
      await expect(input).toHaveValue(targetKm, { timeout: 3000 });
    } else {
      // Button clicked, verify value changed from 30
      const newValue = await input.inputValue();
      expect(Number(newValue)).toBeLessThan(30);
    }
  });

  test('.horizon-set-btn is focusable via keyboard', async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem('meshPlanner_coverageSettings', JSON.stringify({ maxRadiusKm: 30, env: 'suburban' }))
    );
    await page.reload();
    await page.waitForSelector('.toolbar');
    const tourOverlay = page.locator('.tour-overlay');
    if (await tourOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tourOverlay.click({ position: { x: 5, y: 5 } });
      await tourOverlay.waitFor({ state: 'hidden', timeout: 3000 });
    }

    await setupPlanWithNode(page, 3);

    const input = page.locator('#maxRadiusKm');
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill('30');
      await input.press('Tab');
    }

    const setBtn = page.locator('.horizon-set-btn');
    await setBtn.waitFor({ state: 'visible', timeout: 8000 });
    await setBtn.focus();
    await expect(setBtn).toBeFocused();
    await expect(setBtn).toBeEnabled();
  });
});
