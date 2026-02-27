/**
 * Playwright integration tests for the Exit App dialog.
 * Verifies the top-level Exit button, confirmation dialog,
 * close button (X), Cancel button, and accessibility.
 */

import { test, expect } from '@playwright/test';

test.describe('Exit App Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.toolbar');

    // Dismiss the WelcomeTour overlay if it appears
    const overlay = page.locator('.tour-overlay');
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await overlay.click({ position: { x: 5, y: 5 } });
      await overlay.waitFor({ state: 'hidden', timeout: 3000 });
    }
  });

  async function clickExitButton(page: import('@playwright/test').Page) {
    await page.locator('.toolbar-exit-btn').click();
  }

  test('toolbar contains a top-level Exit button', async ({ page }) => {
    const exitBtn = page.locator('.toolbar-exit-btn');
    await expect(exitBtn).toBeVisible();
    await expect(exitBtn).toContainText('Exit');
  });

  test('Exit button has a title tooltip', async ({ page }) => {
    const exitBtn = page.locator('.toolbar-exit-btn');
    await expect(exitBtn).toHaveAttribute('title', 'Close the Mesh Community Planner application');
  });

  test('Exit button has aria-label for accessibility', async ({ page }) => {
    const exitBtn = page.locator('.toolbar-exit-btn');
    await expect(exitBtn).toHaveAttribute('aria-label', 'Exit application');
  });

  test('clicking Exit opens the confirmation dialog', async ({ page }) => {
    await clickExitButton(page);

    const dialog = page.locator('.confirm-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.confirm-dialog-body')).toContainText(
      'Closing this tab or window will close the Mesh Community Planner app. Are you sure?'
    );
  });

  test('dialog has danger variant header', async ({ page }) => {
    await clickExitButton(page);

    const header = page.locator('.confirm-dialog-header');
    await expect(header).toHaveClass(/danger/);
  });

  test('dialog shows Exit and Cancel buttons', async ({ page }) => {
    await clickExitButton(page);

    await expect(page.locator('.confirm-dialog-ok')).toContainText('Exit');
    await expect(page.locator('.confirm-dialog-cancel')).toContainText('Cancel');
  });

  test('dialog shows X close button with accessible attributes', async ({ page }) => {
    await clickExitButton(page);

    const closeBtn = page.locator('.confirm-dialog-close');
    await expect(closeBtn).toBeVisible();
    await expect(closeBtn).toHaveAttribute('aria-label', 'Close dialog');
    await expect(closeBtn).toHaveAttribute('title', 'Close dialog');
  });

  test('Cancel button dismisses the dialog without closing the app', async ({ page }) => {
    await clickExitButton(page);

    await expect(page.locator('.confirm-dialog')).toBeVisible();
    await page.locator('.confirm-dialog-cancel').click();

    await expect(page.locator('.confirm-dialog')).not.toBeVisible();
    await expect(page.locator('.toolbar')).toBeVisible();
  });

  test('X close button dismisses the dialog without closing the app', async ({ page }) => {
    await clickExitButton(page);

    await expect(page.locator('.confirm-dialog')).toBeVisible();
    await page.locator('.confirm-dialog-close').click();

    await expect(page.locator('.confirm-dialog')).not.toBeVisible();
    await expect(page.locator('.toolbar')).toBeVisible();
  });

  test('Escape key dismisses the dialog', async ({ page }) => {
    await clickExitButton(page);

    await expect(page.locator('.confirm-dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.locator('.confirm-dialog')).not.toBeVisible();
    await expect(page.locator('.toolbar')).toBeVisible();
  });

  test('backdrop click does NOT dismiss the dialog (closeOnBackdrop=false)', async ({ page }) => {
    await clickExitButton(page);

    await expect(page.locator('.confirm-dialog')).toBeVisible();
    await page.locator('.confirm-dialog-overlay').click({ position: { x: 5, y: 5 } });

    // Dialog should still be visible
    await expect(page.locator('.confirm-dialog')).toBeVisible();
  });

  test('dialog title says "Exit Application"', async ({ page }) => {
    await clickExitButton(page);

    await expect(page.locator('.confirm-dialog-title')).toContainText('Exit Application');
  });

  test('Cancel, X, and Exit buttons are keyboard focusable', async ({ page }) => {
    await clickExitButton(page);

    // Verify all three dialog buttons exist, are visible, and are not
    // excluded from the tab order (i.e. no tabindex="-1").
    const cancelBtn = page.locator('.confirm-dialog-cancel');
    const closeBtn = page.locator('.confirm-dialog-close');
    const exitBtn = page.locator('.confirm-dialog-ok');

    await expect(cancelBtn).toBeVisible();
    await expect(closeBtn).toBeVisible();
    await expect(exitBtn).toBeVisible();

    // Buttons are <button> elements — inherently focusable unless disabled or tabindex=-1
    await expect(cancelBtn).toBeEnabled();
    await expect(closeBtn).toBeEnabled();
    await expect(exitBtn).toBeEnabled();

    // Verify no tabindex=-1 that would exclude them
    const cancelTab = await cancelBtn.getAttribute('tabindex');
    const closeTab = await closeBtn.getAttribute('tabindex');
    const exitTab = await exitBtn.getAttribute('tabindex');
    expect(cancelTab).not.toBe('-1');
    expect(closeTab).not.toBe('-1');
    expect(exitTab).not.toBe('-1');
  });

  test('Exit button is not a keyboard trap — focus can leave the dialog', async ({ page }) => {
    await clickExitButton(page);

    // Press Escape to close (dialog has a global keydown listener)
    await page.keyboard.press('Escape');

    // Dialog dismissed — focus returns to the page
    await expect(page.locator('.confirm-dialog')).not.toBeVisible();
    await expect(page.locator('.toolbar')).toBeVisible();
  });

  test('dialog has role="alertdialog" and aria-modal="true"', async ({ page }) => {
    await clickExitButton(page);

    const dialog = page.locator('.confirm-dialog');
    await expect(dialog).toHaveAttribute('role', 'alertdialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('dialog has aria-label matching title', async ({ page }) => {
    await clickExitButton(page);

    const dialog = page.locator('.confirm-dialog');
    await expect(dialog).toHaveAttribute('aria-label', 'Exit Application');
  });

  test('Tab key cycles through dialog buttons without escaping', async ({ page, browserName }) => {
    // Firefox does not reliably support programmatic .focus() on buttons in Playwright
    test.skip(browserName === 'firefox', 'Firefox focus behavior differs in Playwright');

    await clickExitButton(page);

    // Dialog auto-focuses the Exit (OK) button
    const exitBtn = page.locator('.confirm-dialog-ok');
    await expect(exitBtn).toBeFocused({ timeout: 2000 });

    // Tab: Exit → Close(X) — wraps from last to first in DOM
    await page.keyboard.press('Tab');
    await expect(page.locator('.confirm-dialog-close')).toBeFocused();

    // Tab: Close(X) → Cancel
    await page.keyboard.press('Tab');
    await expect(page.locator('.confirm-dialog-cancel')).toBeFocused();

    // Tab: Cancel → Exit — wraps back
    await page.keyboard.press('Tab');
    await expect(exitBtn).toBeFocused();
  });

  test('Shift+Tab cycles backward through dialog buttons', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'Firefox focus behavior differs in Playwright');

    await clickExitButton(page);

    // Dialog auto-focuses the Exit (OK) button
    const exitBtn = page.locator('.confirm-dialog-ok');
    await expect(exitBtn).toBeFocused({ timeout: 2000 });

    // Shift+Tab: Exit → Cancel (previous in DOM)
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.confirm-dialog-cancel')).toBeFocused();

    // Shift+Tab: Cancel → Close(X)
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.confirm-dialog-close')).toBeFocused();

    // Shift+Tab: Close(X) → Exit — wraps
    await page.keyboard.press('Shift+Tab');
    await expect(exitBtn).toBeFocused();
  });

  test('__exitConfirmed flag is set before window.close on Exit confirm', async ({ page }) => {
    await clickExitButton(page);

    // Verify the flag starts as falsy
    const flagBefore = await page.evaluate(() => (window as any).__exitConfirmed);
    expect(flagBefore).toBeFalsy();

    // Intercept window.close so the page doesn't actually close
    await page.evaluate(() => { (window as any).close = () => {}; });

    // Click the Exit confirm button
    await page.locator('.confirm-dialog-ok').click();

    // The flag should now be true (set before window.close)
    const flagAfter = await page.evaluate(() => (window as any).__exitConfirmed);
    expect(flagAfter).toBe(true);
  });
});
