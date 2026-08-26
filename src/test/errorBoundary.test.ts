import { describe, expect, it } from 'vitest';
import { isStaleDeploymentError } from '@/components/ErrorBoundary';

describe('stale deployment recovery', () => {
  it.each([
    'Failed to fetch dynamically imported module: /assets/Settings-old.js',
    'Importing a module script failed',
    'ChunkLoadError: Loading chunk 42 failed',
  ])('recognises a missing build chunk: %s', (message) => {
    expect(isStaleDeploymentError(new Error(message))).toBe(true);
  });

  it('does not reload for ordinary application errors', () => {
    expect(isStaleDeploymentError(new Error('Unable to save preferences'))).toBe(false);
  });
});
