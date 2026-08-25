import { expect, test } from '@playwright/test';

test('shows coherent invite-only beta authentication', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Kitchen Companion' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign Up' }).last().click();
  await expect(page.getByLabel('Beta invitation code')).toBeVisible();
  await expect(page.getByText('Invitation codes are tied to your email and work once.')).toBeVisible();
});
