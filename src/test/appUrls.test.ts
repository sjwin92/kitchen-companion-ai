import { describe, expect, it } from 'vitest';
import { appUrl, authRedirectUrl } from '@/lib/appUrls';

describe('appUrl', () => {
  it('keeps GitHub Pages recovery links inside the application base path', () => {
    expect(appUrl('reset-password', 'https://sjwin92.github.io', '/kitchen-companion-ai/'))
      .toBe('https://sjwin92.github.io/kitchen-companion-ai/reset-password');
  });

  it('supports root deployments', () => {
    expect(appUrl('/privacy', 'https://kitchen.example', '/'))
      .toBe('https://kitchen.example/privacy');
  });

  it('returns recovery links to the deployment that requested them', () => {
    expect(authRedirectUrl('reset-password', 'https://589c17b6.kitchen-companion-beta.pages.dev', '/'))
      .toBe('https://589c17b6.kitchen-companion-beta.pages.dev/reset-password');
  });
});
