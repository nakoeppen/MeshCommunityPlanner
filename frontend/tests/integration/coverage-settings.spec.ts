/**
 * Playwright integration tests for coverage settings UI.
 * Verifies max radius input, remember checkbox, and stale settings warning.
 */

import { test, expect } from '@playwright/test';

test.describe('Coverage Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.toolbar');

    // Dismiss welcome tour if present
    const overlay = page.locator('.tour-overlay');
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await overlay.click({ position: { x: 5, y: 5 } });
      await overlay.waitFor({ state: 'hidden', timeout: 3000 });
    }

    // Clear localStorage coverage settings before each test
    await page.evaluate(() => localStorage.removeItem('meshPlanner_coverageSettings'));
  });

  test('max radius input is visible in sidebar with default value of 15', async ({ page }) => {
    const input = page.locator('#maxRadiusKm');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('15');
  });

  test('max radius input accepts values between 1 and 50', async ({ page }) => {
    const input = page.locator('#maxRadiusKm');
    await input.fill('30');
    await expect(input).toHaveValue('30');
  });

  test('large radius warning appears above 25 km', async ({ page }) => {
    const input = page.locator('#maxRadiusKm');
    await input.fill('30');
    const warning = page.locator('.sidebar-hint', { hasText: 'Large radius' });
    await expect(warning).toBeVisible();
  });

  test('large radius warning hidden at or below 25 km', async ({ page }) => {
    const input = page.locator('#maxRadiusKm');
    await input.fill('20');
    const warning = page.locator('.sidebar-hint', { hasText: 'Large radius' });
    await expect(warning).not.toBeVisible();
  });

  test('remember checkbox is present and unchecked by default', async ({ page }) => {
    const checkbox = page.locator('#rememberCoverageSettings');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test('checking remember persists settings to localStorage', async ({ page }) => {
    const input = page.locator('#maxRadiusKm');
    await input.fill('25');
    await page.locator('#rememberCoverageSettings').check();

    const saved = await page.evaluate(() => localStorage.getItem('meshPlanner_coverageSettings'));
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.maxRadiusKm).toBe(25);
  });

  test('unchecking remember removes settings from localStorage', async ({ page }) => {
    // Set up saved state
    await page.evaluate(() =>
      localStorage.setItem('meshPlanner_coverageSettings', JSON.stringify({ maxRadiusKm: 20, env: 'suburban' }))
    );
    await page.reload();
    await page.waitForSelector('.toolbar');

    const checkbox = page.locator('#rememberCoverageSettings');
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();

    const saved = await page.evaluate(() => localStorage.getItem('meshPlanner_coverageSettings'));
    expect(saved).toBeNull();
  });

  test('saved radius is restored on page reload', async ({ page }) => {
    await page.evaluate(() =>
      localStorage.setItem('meshPlanner_coverageSettings', JSON.stringify({ maxRadiusKm: 35, env: 'suburban' }))
    );
    await page.reload();
    await page.waitForSelector('.toolbar');

    const input = page.locator('#maxRadiusKm');
    await expect(input).toHaveValue('35');
    await expect(page.locator('#rememberCoverageSettings')).toBeChecked();
  });

  test('max radius input has accessible label', async ({ page }) => {
    const label = page.locator('label[for="maxRadiusKm"]');
    await expect(label).toBeVisible();
    await expect(label).toContainText('Max Radius');
  });
});
