import { describe, expect, it } from 'vitest';
import { appUrl } from '@/lib/appUrls';

describe('appUrl', () => {
  it('keeps GitHub Pages recovery links inside the application base path', () => {
    expect(appUrl('reset-password', 'https://sjwin92.github.io', '/kitchen-companion-ai/'))
      .toBe('https://sjwin92.github.io/kitchen-companion-ai/reset-password');
  });

  it('supports root deployments', () => {
    expect(appUrl('/privacy', 'https://kitchen.example', '/'))
      .toBe('https://kitchen.example/privacy');
  });
});
