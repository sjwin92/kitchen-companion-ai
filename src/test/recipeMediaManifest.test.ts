import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type MediaAsset = {
  slug: string;
  status?: 'pending_generation' | 'published';
  file?: string;
  storage_path?: string;
  target_file?: string;
  target_storage_path?: string;
  prompt: string;
};

const readJson = <T,>(path: string) => JSON.parse(readFileSync(resolve(path), 'utf8')) as T;

describe('recipe media manifests', () => {
  it('records the 12 reviewed starter assets and their local files', () => {
    const manifest = readJson<{ assets: MediaAsset[] }>('catalogue/media/starter-images.json');

    expect(manifest.assets).toHaveLength(12);
    expect(new Set(manifest.assets.map(({ slug }) => slug)).size).toBe(12);
    for (const asset of manifest.assets) {
      expect(asset.prompt.length).toBeGreaterThan(300);
      expect(asset.storage_path).toBe(`catalogue/${asset.slug}.jpg`);
      expect(existsSync(resolve(asset.file!))).toBe(true);
    }
  });

  it('keeps one distinct, recipe-specific prompt for every beta candidate', () => {
    const queue = readJson<{ assets: MediaAsset[] }>('catalogue/media/beta-200-image-queue.json');

    expect(queue.assets).toHaveLength(188);
    expect(new Set(queue.assets.map(({ slug }) => slug)).size).toBe(188);
    expect(new Set(queue.assets.map(({ prompt }) => prompt)).size).toBe(188);
    for (const asset of queue.assets) {
      expect(asset.prompt).toContain('Dish:');
      expect(asset.prompt).toContain('Visible ingredients must agree with this recipe:');
      expect(asset.target_storage_path).toBe(`catalogue/${asset.slug}.jpg`);

      if (asset.status === 'published') {
        expect(existsSync(resolve(asset.target_file!))).toBe(true);
      }
    }

    expect(queue.assets.filter(({ status }) => status === 'published')).toHaveLength(44);
    expect(queue.assets.filter(({ status }) => status === 'pending_generation')).toHaveLength(144);
  });
});
