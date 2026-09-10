import { createHash } from 'node:crypto';
import { readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const IMAGE_DIR = path.join(ROOT, 'public/images/recipes');
const MANIFEST_PATH = path.join(ROOT, 'catalogue/media/recipe-media-variants.json');
const CARD_LIMIT = 120 * 1024;
const DETAIL_LIMIT = 300 * 1024;

async function encodeWithinLimit(pipeline, options, limit, output) {
  let quality = options.quality;
  let result;
  do {
    result = await pipeline.clone().webp({ quality, effort: 6 }).toBuffer();
    quality -= 4;
  } while (result.length > limit && quality >= 44);
  if (result.length > limit) throw new Error(`${path.basename(output)} is ${result.length} bytes; limit is ${limit}`);
  await writeFile(output, result);
  return result.length;
}

const files = await readdir(IMAGE_DIR);
const sources = new Map();
for (const file of files) {
  const match = file.match(/^(.+)\.(jpe?g|png)$/i);
  if (!match || /\.(card|detail)$/.test(match[1])) continue;
  const current = sources.get(match[1]);
  if (!current || file.endsWith('.png')) sources.set(match[1], file);
}

const assets = [];
for (const [stem, sourceFile] of [...sources.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const sourcePath = path.join(IMAGE_DIR, sourceFile);
  const originalPath = path.join(IMAGE_DIR, `${stem}.jpg`);
  const originalTempPath = path.join(IMAGE_DIR, `${stem}.original.tmp.jpg`);
  const cardPath = path.join(IMAGE_DIR, `${stem}.card.webp`);
  const detailPath = path.join(IMAGE_DIR, `${stem}.detail.webp`);

  const source = sharp(sourcePath).rotate();
  const originalBuffer = await source.clone()
    .resize(1024, 1280, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  await writeFile(originalTempPath, originalBuffer);
  await rename(originalTempPath, originalPath);

  const cardBytes = await encodeWithinLimit(
    sharp(originalBuffer).resize(640, 800, { fit: 'cover' }),
    { quality: 72 },
    CARD_LIMIT,
    cardPath,
  );
  const detailBytes = await encodeWithinLimit(
    sharp(originalBuffer).resize(1024, 1280, { fit: 'cover' }),
    { quality: 78 },
    DETAIL_LIMIT,
    detailPath,
  );

  if (sourceFile.endsWith('.png')) await unlink(sourcePath);
  assets.push({
    slug: stem,
    original: `/images/recipes/${stem}.jpg`,
    card: `/images/recipes/${stem}.card.webp`,
    detail: `/images/recipes/${stem}.detail.webp`,
    width: 1024,
    height: 1280,
    card_bytes: cardBytes,
    detail_bytes: detailBytes,
    content_hash: createHash('sha256').update(originalBuffer).digest('hex'),
  });
}

await writeFile(MANIFEST_PATH, `${JSON.stringify({ version: 1, generated_at: new Date().toISOString(), assets }, null, 2)}\n`);
console.log(JSON.stringify({ assets: assets.length, card_limit_bytes: CARD_LIMIT, detail_limit_bytes: DETAIL_LIMIT }));
