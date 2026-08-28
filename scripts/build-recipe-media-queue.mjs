import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogueDir = path.join(root, 'catalogue', 'beta-200');
const outputPath = path.join(root, 'catalogue', 'media', 'beta-200-image-queue.json');

let previousAssets = new Map();
try {
  const previousQueue = JSON.parse(await readFile(outputPath, 'utf8'));
  previousAssets = new Map(previousQueue.assets.map((asset) => [asset.slug, asset]));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const scenes = [
  'a matte dark forest-green stone table with restrained negative space',
  'a beautifully dressed contemporary table with natural linen, handmade ceramics and subtle glassware',
  'a warm pale-stone table with one folded linen napkin and soft tonal shadows',
  'a refined dark timber dining table with understated modern place settings',
];

const angles = [
  'editorial overhead view',
  'gentle three-quarter tabletop view',
  'close overhead crop with the plate slightly off-centre',
];

const buildPrompt = (recipe, index) => [
  'Premium recipe-card food photograph for Kitchen Companion.',
  `Dish: ${recipe.title}.`,
  recipe.description ? `Dish details: ${recipe.description}.` : '',
  `Visible ingredients must agree with this recipe: ${recipe.ingredients.map(({ name }) => name).join(', ')}.`,
  `Setting: ${scenes[index % scenes.length]}.`,
  `Composition: ${angles[index % angles.length]}; vertical 4:5 crop; dish is the clear subject; leave calm negative space where natural.`,
  'Lighting: soft natural window light, gentle falloff, warm-neutral white balance and subtle photographic grain.',
  'Aesthetic: refined contemporary cookbook editorial, appetising real food texture, sophisticated, believable and quietly luxurious.',
  'Vary the ceramics, linen, surface, garnish restraint and framing while keeping the same editorial family.',
  'No text, logos, packaging, watermarks or branded tableware. No hands unless specifically requested.',
  'Avoid plastic-looking food, oversaturation, floating ingredients, excessive garnish, perfect symmetry, glossy stock-photo styling and rustic clichés.',
].filter(Boolean).join(' ');

const files = (await readdir(catalogueDir))
  .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
  .sort();

const recipes = [];
for (const file of files) {
  const pack = JSON.parse(await readFile(path.join(catalogueDir, file), 'utf8'));
  recipes.push(...pack.recipes.map((recipe) => ({ ...recipe, pack: pack.book.slug })));
}

if (recipes.length !== 188) {
  throw new Error(`Expected 188 beta recipes, found ${recipes.length}`);
}

const queue = {
  style_version: 'kitchen-companion-editorial-v1',
  generated_at: new Date().toISOString(),
  policy: 'One recipe-specific asset per generation call. Human review is required before upload or publication.',
  assets: recipes.map((recipe, index) => {
    const previous = previousAssets.get(recipe.slug);

    return {
      slug: recipe.slug,
      title: recipe.title,
      pack: recipe.pack,
      status: previous?.status ?? 'pending_generation',
      target_file: `public/images/recipes/${recipe.slug}.jpg`,
      target_storage_path: `catalogue/${recipe.slug}.jpg`,
      prompt: buildPrompt(recipe, index),
    };
  }),
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(queue, null, 2)}\n`);
console.log(`Prepared ${queue.assets.length} recipe-specific image prompts at ${path.relative(root, outputPath)}`);
