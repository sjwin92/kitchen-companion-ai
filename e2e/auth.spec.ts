import { expect, test } from '@playwright/test';

test('shows coherent invite-only beta authentication', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Kitchen Companion' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign Up' }).last().click();
  await expect(page.getByLabel('Beta invitation code')).toBeVisible();
  await expect(page.getByText('Invitation codes are tied to your email and work once.')).toBeVisible();
});

test('connects the dashboard loop, menu and search to real destinations', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop navigation is intentionally hidden on mobile.');

  const userId = '00000000-0000-4000-8000-000000000001';
  await page.addInitScript(({ id }) => {
    const encode = (value: object) => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const expiresAt = Math.floor(Date.now() / 1000) + 3_600;
    const user = {
      id,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'browser-test@kitchen.local',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    };
    const accessToken = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: id, role: 'authenticated', aud: 'authenticated', exp: expiresAt })}.test`;
    localStorage.setItem('sb-127-auth-token', JSON.stringify({
      access_token: accessToken,
      refresh_token: 'browser-test-refresh',
      token_type: 'bearer',
      expires_in: 3_600,
      expires_at: expiresAt,
      user,
    }));
  }, { id: userId });

  await page.route('http://127.0.0.1:54321/rest/v1/**', async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith('/profiles')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: userId,
          display_name: 'Beta Tester',
          household_size: 2,
          dietary_preferences: ['Vegan'],
          cooking_time: '30 min',
          max_prep_time: 60,
          daily_calorie_goal: 2_000,
          disliked_ingredients: [],
          onboarding_complete: true,
          preferred_cuisines: [],
          allergies: [],
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What’s happening in your kitchen today?' })).toBeVisible();
  await page.getByRole('button', { name: 'Open kitchen menu' }).click();
  await expect(page.getByRole('button', { name: /Add food/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Buy missing items/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Record the outcome/ })).toBeVisible();
  await page.getByRole('button', { name: /Record the outcome/ }).click();
  await expect(page.getByRole('heading', { name: 'What happened to the food?' })).toBeVisible();
  await expect(page.getByRole('link', { name: /We ate it/ })).toHaveAttribute('href', '/meal-log');
  await expect(page.getByRole('link', { name: /It was wasted/ })).toHaveAttribute('href', '/waste');
  await page.goto('/');

  await page.getByRole('button', { name: 'Open kitchen menu' }).click();
  await expect(page.getByRole('heading', { name: 'Your kitchen loop' })).toBeVisible();
  await expect(page.getByText('Build the week from your recipe shelf')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Search Kitchen Companion' }).click();
  await page.getByPlaceholder('Where do you want to go?').fill('recipe shelf');
  await page.getByText('Recipe books').click();
  await expect(page).toHaveURL(/\/recipe-books$/);
  await expect(page.getByRole('heading', { name: 'A shelf that cooks with you' })).toBeVisible();
  await expect(page.getByText('Three starter packs are in review')).toBeVisible();

  await page.goto('/meals');
  await expect(page.getByRole('heading', { name: 'Cook from what you have' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The first recipe packs are in review' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recipe lab' })).toBeVisible();
});

test('makes beta privacy, terms and support information public before sign-in', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy notice' })).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: 'Terms of use' })).toBeVisible();
  await page.goto('/support');
  await expect(page.getByRole('heading', { name: 'Support' })).toBeVisible();
});
