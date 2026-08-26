import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createClient } from '@supabase/supabase-js';

// Loads the public-domain USDA food composition pack into
// public.ingredient_reference. Reference data is shared by every user, so this
// runs with the service-role key and never from the browser.
//
//   npm run reference:validate
//   npm run reference:import
//
// Re-running is safe: rows are upserted on slug and aliases on (alias, locale).

const validateOnly = process.argv.includes('--validate-only');
const inputPath =
  process.argv.slice(2).find(argument => !argument.startsWith('--')) ??
  'catalogue/reference/ingredient-reference-usda-sr-legacy.json.gz';
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE = 500;

const raw = await readFile(inputPath);
const text = inputPath.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
const payload = JSON.parse(text);

const requiredText = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} is required`);
  return value.trim();
};
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const rightsBases = ['original_owned', 'creator_permission', 'licensed', 'public_domain'];
const reviewStates = ['draft', 'in_review', 'approved', 'rejected', 'archived'];

const dataset = payload.dataset;
if (!dataset) throw new Error('dataset metadata is required');
requiredText(dataset.source, 'dataset.source');
requiredText(dataset.source_url, 'dataset.source_url');
requiredText(dataset.rights_notes, 'dataset.rights_notes');
if (!rightsBases.includes(dataset.rights_basis)) {
  throw new Error('dataset.rights_basis must confirm a valid publishing basis');
}

const ingredients = payload.ingredients;
if (!Array.isArray(ingredients) || ingredients.length === 0) {
  throw new Error('ingredients must be a non-empty array');
}

const seenSlugs = new Set();
const seenAliases = new Set();
for (const [index, ingredient] of ingredients.entries()) {
  const label = `ingredients[${index}]`;
  const slug = requiredText(ingredient.slug, `${label}.slug`);
  if (!slugPattern.test(slug)) throw new Error(`${label}.slug must be lowercase kebab-case`);
  if (seenSlugs.has(slug)) throw new Error(`Duplicate ingredient slug: ${slug}`);
  seenSlugs.add(slug);
  requiredText(ingredient.display_name, `${label}.display_name`);
  if (typeof ingredient.nutrition_per_100g !== 'object' || ingredient.nutrition_per_100g === null) {
    throw new Error(`${label}.nutrition_per_100g must be an object`);
  }
  if (!Array.isArray(ingredient.portions)) {
    throw new Error(`${label}.portions must be an array`);
  }
  for (const [portionIndex, portion] of ingredient.portions.entries()) {
    if (typeof portion.grams_per_unit !== 'number' || !(portion.grams_per_unit > 0)) {
      throw new Error(`${label}.portions[${portionIndex}].grams_per_unit must be a positive number`);
    }
  }
  if (!rightsBases.includes(ingredient.rights_basis)) {
    throw new Error(`${label}.rights_basis is invalid`);
  }
  if (!reviewStates.includes(ingredient.review_status)) {
    throw new Error(`${label}.review_status is invalid`);
  }
  for (const alias of ingredient.aliases ?? []) {
    const key = `${alias.toLowerCase()}|en-GB`;
    if (seenAliases.has(key)) throw new Error(`Duplicate alias: ${alias}`);
    seenAliases.add(key);
  }
}

if (validateOnly) {
  console.log(
    `Validated ${ingredients.length} ingredient reference rows from ${dataset.title}. ` +
      'Rows import as drafts; shelf-life defaults still need editorial review.',
  );
  process.exit(0);
}

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Never expose the service-role key to Vite.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const fail = (message, error) => {
  throw new Error(`${message}: ${error?.message ?? 'unknown database error'}`);
};

const chunk = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );

let upserted = 0;
const idBySlug = new Map();

for (const batch of chunk(ingredients, BATCH_SIZE)) {
  const rows = batch.map(ingredient => ({
    slug: ingredient.slug,
    display_name: ingredient.display_name,
    category: ingredient.category ?? null,
    aisle: ingredient.aisle ?? null,
    nutrition_per_100g: ingredient.nutrition_per_100g,
    portions: ingredient.portions,
    allergen_tags: ingredient.allergen_tags ?? [],
    dietary_tags: ingredient.dietary_tags ?? [],
    shelf_life_fridge_days: ingredient.shelf_life_fridge_days ?? null,
    shelf_life_pantry_days: ingredient.shelf_life_pantry_days ?? null,
    shelf_life_freezer_days: ingredient.shelf_life_freezer_days ?? null,
    is_whole_food: Boolean(ingredient.is_whole_food),
    fdc_id: ingredient.fdc_id ?? null,
    source: ingredient.source ?? dataset.source,
    source_url: ingredient.source_url ?? dataset.source_url,
    rights_basis: ingredient.rights_basis,
    rights_notes: dataset.rights_notes,
    review_status: ingredient.review_status,
    content_version: dataset.content_version ?? 1,
  }));

  const { data, error } = await supabase
    .from('ingredient_reference')
    .upsert(rows, { onConflict: 'slug' })
    .select('id, slug');
  if (error) fail('Failed to upsert ingredient reference rows', error);
  for (const row of data ?? []) idBySlug.set(row.slug, row.id);
  upserted += rows.length;
  console.log(`Upserted ${upserted}/${ingredients.length} ingredient reference rows.`);
}

const aliasRows = ingredients.flatMap(ingredient =>
  (ingredient.aliases ?? [])
    .map(alias => ({
      ingredient_reference_id: idBySlug.get(ingredient.slug),
      alias,
      locale: 'en-GB',
    }))
    .filter(row => row.ingredient_reference_id),
);

for (const batch of chunk(aliasRows, BATCH_SIZE)) {
  const { error } = await supabase
    .from('ingredient_reference_aliases')
    .upsert(batch, { onConflict: 'alias,locale' });
  if (error) fail('Failed to upsert ingredient aliases', error);
}

console.log(
  `Imported ${upserted} ingredient reference rows and ${aliasRows.length} aliases from ${dataset.title}.`,
);
console.log('Rows are drafts. Editorial review of shelf-life and allergen defaults is still required.');
