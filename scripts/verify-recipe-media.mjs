import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const manifest = JSON.parse(await readFile(path.join(ROOT, 'catalogue/media/recipe-media-variants.json'), 'utf8'));
const assets = manifest.assets ?? [];
const expected = Number(process.env.RECIPE_MEDIA_EXPECTED ?? 200);
if (assets.length !== expected) throw new Error(`Expected ${expected} recipe media records; found ${assets.length}`);
if (new Set(assets.map((asset) => asset.slug)).size !== expected) throw new Error('Recipe media slugs must be unique');

for (const asset of assets) {
  if (!asset.content_hash || asset.width !== 1024 || asset.height !== 1280) throw new Error(`Incomplete media metadata for ${asset.slug}`);
  for (const [variant, limit] of [['original', Infinity], ['card', 120 * 1024], ['detail', 300 * 1024]]) {
    const file = path.join(ROOT, 'public', asset[variant].replace(/^\//, ''));
    await access(file);
    const info = await stat(file);
    if (info.size > limit) throw new Error(`${asset.slug} ${variant} exceeds ${limit} bytes`);
  }
}

console.log(JSON.stringify({ verified: assets.length }));
