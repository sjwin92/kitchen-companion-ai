import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const catalogueDir = path.resolve('catalogue/beta-200');
const manifest = JSON.parse(await readFile(path.join(catalogueDir, 'manifest.json'), 'utf8'));
const packFiles = (await readdir(catalogueDir))
  .filter(file => file.endsWith('.json') && file !== 'manifest.json')
  .sort();

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(manifest.batch === 'beta-200', 'Manifest must identify the beta-200 batch');
assert(manifest.existing_approved_count === 12, 'The baseline must contain 12 reviewed recipes');
assert(manifest.candidate_count === 188, 'The candidate catalogue must contain exactly 188 recipes');
assert(manifest.database_target === 200, 'The database target must be 200 recipes');
assert(packFiles.length === manifest.packs.length, 'Manifest pack count does not match generated files');

const payloads = await Promise.all(packFiles.map(async file => (
  JSON.parse(await readFile(path.join(catalogueDir, file), 'utf8'))
)));
const recipes = payloads.flatMap(payload => payload.recipes ?? []);

for (const payload of payloads) {
  assert(payload.creator?.slug, `${payload.book?.slug ?? 'Unknown pack'} is missing a creator`);
  assert(payload.book?.slug, 'Every pack needs a slug');
  assert(payload.recipes.length >= 8 && payload.recipes.length <= 15, `${payload.book.slug} must contain 8–15 recipes`);

  for (const recipe of payload.recipes) {
    assert(recipe.catalogue_batch === 'beta-200', `${recipe.slug} has the wrong catalogue batch`);
    assert(recipe.source_type === 'ai_assisted', `${recipe.slug} must retain AI-assisted draft provenance`);
    assert(recipe.rights_basis === 'original_owned', `${recipe.slug} is missing its declared rights basis`);
    assert(recipe.rights_notes?.includes('review'), `${recipe.slug} is missing its human-review warning`);
    assert(recipe.content_version === 1, `${recipe.slug} must begin at content version 1`);
    assert(recipe.dedupe_hash?.length === 64, `${recipe.slug} needs a SHA-256 deduplication hash`);
    assert(recipe.instructions?.length >= 3, `${recipe.slug} needs a complete method`);
    assert(recipe.ingredients?.length >= 4, `${recipe.slug} needs structured ingredients`);
    assert(recipe.ingredients.every(item => item.normalized_name && item.quantity > 0 && item.unit), `${recipe.slug} has an incomplete ingredient`);
    assert(recipe.nutrition?.calories_low > 0 && recipe.nutrition?.calories_high >= recipe.nutrition.calories_low, `${recipe.slug} needs a calorie range`);
    assert(recipe.nutrition_provenance === 'estimated', `${recipe.slug} must label estimated nutrition`);
    assert(recipe.estimated_cost_low_gbp > 0 && recipe.estimated_cost_high_gbp >= recipe.estimated_cost_low_gbp, `${recipe.slug} needs a valid cost range`);
    assert(typeof recipe.storage_guidance?.freezer_friendly === 'boolean', `${recipe.slug} needs storage guidance`);
    assert(recipe.verification_tier == null, `${recipe.slug} must remain unverified before review`);
  }
}

assert(recipes.length === 188, `Expected 188 candidates; found ${recipes.length}`);
assert(new Set(recipes.map(recipe => recipe.slug)).size === recipes.length, 'Recipe slugs must be unique');
assert(new Set(recipes.map(recipe => recipe.dedupe_hash)).size === recipes.length, 'Recipe deduplication hashes must be unique');

const countTag = tag => recipes.filter(recipe => recipe.dietary_tags.includes(tag)).length;
const coverage = {
  totalDatabaseRecipes: manifest.existing_approved_count + recipes.length,
  privateCandidates: recipes.length,
  packs: payloads.length,
  vegan: countTag('vegan'),
  vegetarian: countTag('vegetarian'),
  pescatarian: countTag('pescatarian'),
  glutenFree: countTag('gluten-free'),
  withNutrition: recipes.filter(recipe => recipe.nutrition?.calories).length,
  withCosts: recipes.filter(recipe => recipe.estimated_cost_low_gbp).length,
  withStorage: recipes.filter(recipe => recipe.storage_guidance).length,
};

console.log(`Catalogue verified: ${JSON.stringify(coverage)}`);
