import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const route of ['/', '/privacy', '/terms', '/support']) {
  test(`${route} has no serious accessibility violations or horizontal overflow`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('body')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact ?? ''));
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}

test('authentication is operable using the keyboard', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await page.getByLabel('Email').focus();
  await page.keyboard.type('keyboard-test@kitchen.local');
  await expect(page.getByLabel('Email')).toHaveValue('keyboard-test@kitchen.local');
});
