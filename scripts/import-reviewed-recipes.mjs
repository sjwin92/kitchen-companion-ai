import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const validateOnly = process.argv.includes('--validate-only');
const inputPath = process.argv.slice(2).find(argument => argument !== '--validate-only');
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!inputPath) throw new Error('Usage: npm run catalogue:validate -- path/to/catalogue.json');

const payload = JSON.parse(await readFile(inputPath, 'utf8'));
const requiredText = (value, label) => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} is required`);
  return value.trim();
};
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const requireSlug = (value, label) => {
  const slug = requiredText(value, label);
  if (!slugPattern.test(slug)) throw new Error(`${label} must be a lowercase kebab-case slug`);
  return slug;
};
const requireArray = (value, label) => {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array`);
  return value;
};

const creator = payload.creator;
const book = payload.book;
const recipes = requireArray(payload.recipes, 'recipes');
if (!creator || !book) throw new Error('creator and book are required');
requireSlug(creator.slug, 'creator.slug');
requireSlug(book.slug, 'book.slug');

const seenSlugs = new Set();
for (const [recipeIndex, recipe] of recipes.entries()) {
  const label = `recipes[${recipeIndex}]`;
  const slug = requireSlug(recipe.slug, `${label}.slug`);
  if (seenSlugs.has(slug)) throw new Error(`Duplicate recipe slug: ${slug}`);
  seenSlugs.add(slug);
  requiredText(recipe.title, `${label}.title`);
  requireArray(recipe.instructions, `${label}.instructions`).forEach((step, index) => requiredText(step, `${label}.instructions[${index}]`));
  requireArray(recipe.ingredients, `${label}.ingredients`).forEach((ingredient, index) => {
    requiredText(ingredient.name, `${label}.ingredients[${index}].name`);
    requiredText(ingredient.normalized_name, `${label}.ingredients[${index}].normalized_name`);
  });
  if (!['original_owned', 'creator_permission', 'licensed', 'public_domain'].includes(recipe.rights_basis)) {
    throw new Error(`${label}.rights_basis must confirm a valid publishing basis`);
  }
  if (!['original', 'creator', 'user_submission', 'ai_assisted'].includes(recipe.source_type)) {
    throw new Error(`${label}.source_type is invalid`);
  }
  if (typeof recipe.source_url === 'string' && /(^|\.)myplate\.gov\//i.test(new URL(recipe.source_url).hostname + '/')) {
    throw new Error(`${label}.source_url cannot import MyPlate content; MyPlate is research-only`);
  }
  if (recipe.rights_basis === 'creator_permission' && !requiredText(recipe.rights_notes, `${label}.rights_notes`)) {
    throw new Error(`${label}.rights_notes must reference the creator's permission evidence`);
  }
}

if (validateOnly) {
  console.log(`Validated ${recipes.length} recipe drafts in “${book.title}”. Human review is still required before publication.`);
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

const { data: existingCreator, error: existingCreatorError } = await supabase
  .from('creators')
  .select('id,review_status')
  .eq('slug', creator.slug)
  .maybeSingle();
if (existingCreatorError) fail('Could not inspect creator', existingCreatorError);

let creatorId = existingCreator?.id;
const creatorFields = {
  slug: creator.slug,
  display_name: requiredText(creator.display_name, 'creator.display_name'),
  bio: creator.bio ?? null,
  website_url: creator.website_url ?? null,
  social_links: creator.social_links ?? {},
};
if (creatorId) {
  const { error } = await supabase.from('creators').update(creatorFields).eq('id', creatorId);
  if (error) fail('Could not update creator draft', error);
} else {
  const { data, error } = await supabase.from('creators').insert({ ...creatorFields, review_status: 'draft' }).select('id').single();
  if (error) fail('Could not create creator draft', error);
  creatorId = data.id;
}

const { error: partnershipError } = await supabase.from('creator_partnerships').upsert(
  { creator_id: creatorId, status: 'prospect' },
  { onConflict: 'creator_id', ignoreDuplicates: true },
);
if (partnershipError) fail('Could not prepare creator partnership controls', partnershipError);

const { data: existingBook, error: existingBookError } = await supabase
  .from('recipe_books')
  .select('id,review_status')
  .eq('slug', book.slug)
  .maybeSingle();
if (existingBookError) fail('Could not inspect recipe book', existingBookError);
if (existingBook?.review_status === 'approved') {
  throw new Error(`Recipe book ${book.slug} is already live; create a new content version instead of overwriting it`);
}

const bookFields = {
  creator_id: creatorId,
  slug: book.slug,
  title: requiredText(book.title, 'book.title'),
  subtitle: book.subtitle ?? null,
  description: book.description ?? null,
  access_model: book.access_model ?? 'included',
  content_version: Number(book.content_version ?? 1),
  review_status: 'draft',
  published_at: null,
};
let bookId = existingBook?.id;
if (bookId) {
  const { error } = await supabase.from('recipe_books').update(bookFields).eq('id', bookId);
  if (error) fail('Could not update recipe book draft', error);
} else {
  const { data, error } = await supabase.from('recipe_books').insert(bookFields).select('id').single();
  if (error) fail('Could not create recipe book draft', error);
  bookId = data.id;
}

const importedRecipeIds = [];
for (const [recipeIndex, recipe] of recipes.entries()) {
  const dedupeHash = createHash('sha256').update(JSON.stringify({
    title: recipe.title.trim().toLowerCase(),
    ingredients: recipe.ingredients.map(ingredient => ingredient.normalized_name.trim().toLowerCase()).sort(),
  })).digest('hex');
  const { data: existingRecipe, error: inspectError } = await supabase
    .from('recipes')
    .select('id,review_status')
    .eq('slug', recipe.slug)
    .maybeSingle();
  if (inspectError) fail(`Could not inspect recipe ${recipe.slug}`, inspectError);
  if (existingRecipe?.review_status === 'approved') {
    throw new Error(`Recipe ${recipe.slug} is already live; create a new content version instead of overwriting it`);
  }

  const recipeFields = {
    creator_id: creatorId,
    slug: recipe.slug,
    title: recipe.title,
    description: recipe.description ?? null,
    image_path: recipe.image_path ?? null,
    youtube_url: recipe.youtube_url ?? null,
    audio_url: recipe.audio_url ?? null,
    servings: Number(recipe.servings ?? 2),
    prep_minutes: Number(recipe.prep_minutes ?? 0),
    cook_minutes: Number(recipe.cook_minutes ?? 0),
    difficulty: recipe.difficulty ?? 'easy',
    cuisine_tags: recipe.cuisine_tags ?? [],
    dietary_tags: recipe.dietary_tags ?? [],
    allergen_tags: recipe.allergen_tags ?? [],
    meal_types: recipe.meal_types ?? ['dinner'],
    instructions: recipe.instructions,
    nutrition: recipe.nutrition ?? {},
    estimated_cost_low_gbp: recipe.estimated_cost_low_gbp ?? null,
    estimated_cost_high_gbp: recipe.estimated_cost_high_gbp ?? null,
    price_estimate_as_of: recipe.price_estimate_as_of ?? null,
    source_type: recipe.source_type,
    source_url: recipe.source_url ?? null,
    rights_basis: recipe.rights_basis,
    rights_notes: recipe.rights_notes ?? null,
    source_label: recipe.source_label ?? (recipe.source_type === 'creator' ? creator.display_name : 'Kitchen Companion'),
    media_attribution: recipe.media_attribution ?? {},
    nutrition_provenance: recipe.nutrition_provenance ?? (Object.keys(recipe.nutrition ?? {}).length > 0 ? 'estimated' : 'unavailable'),
    // A draft is not verified. The guarded review RPC assigns a tier only
    // after the human checklist succeeds and the recipe is published.
    verification_tier: null,
    dedupe_hash: dedupeHash,
    content_version: Number(recipe.content_version ?? 1),
    review_status: 'draft',
    published_at: null,
  };

  let recipeId = existingRecipe?.id;
  if (recipeId) {
    const { error } = await supabase.from('recipes').update(recipeFields).eq('id', recipeId);
    if (error) fail(`Could not update recipe ${recipe.slug}`, error);
  } else {
    const { data, error } = await supabase.from('recipes').insert(recipeFields).select('id').single();
    if (error) fail(`Could not create recipe ${recipe.slug}`, error);
    recipeId = data.id;
  }

  const { error: deleteIngredientsError } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
  if (deleteIngredientsError) fail(`Could not replace ingredients for ${recipe.slug}`, deleteIngredientsError);

  const canonicalRows = [...new Map(recipe.ingredients.map(ingredient => [
    ingredient.normalized_name.trim().toLowerCase(),
    {
      canonical_name: ingredient.normalized_name.trim().toLowerCase(),
      display_name: ingredient.name.trim(),
      default_aisle: ingredient.aisle ?? null,
    },
  ])).values()];
  const { error: canonicalError } = await supabase.from('ingredients').upsert(canonicalRows, { onConflict: 'canonical_name' });
  if (canonicalError) fail(`Could not normalize ingredients for ${recipe.slug}`, canonicalError);
  const { data: canonicalData, error: canonicalReadError } = await supabase
    .from('ingredients')
    .select('id,canonical_name')
    .in('canonical_name', canonicalRows.map(row => row.canonical_name));
  if (canonicalReadError) fail(`Could not read normalized ingredients for ${recipe.slug}`, canonicalReadError);
  const ingredientIds = new Map((canonicalData ?? []).map(row => [row.canonical_name, row.id]));
  const aliases = recipe.ingredients.map(ingredient => ({
    alias: ingredient.name.trim().toLowerCase(),
    ingredient_id: ingredientIds.get(ingredient.normalized_name.trim().toLowerCase()),
  })).filter(alias => alias.ingredient_id);
  const { error: aliasError } = await supabase.from('ingredient_aliases').upsert(aliases, { onConflict: 'alias', ignoreDuplicates: true });
  if (aliasError) fail(`Could not save ingredient aliases for ${recipe.slug}`, aliasError);
  const { error: ingredientError } = await supabase.from('recipe_ingredients').insert(
    recipe.ingredients.map((ingredient, position) => ({
      recipe_id: recipeId,
      position,
      name: ingredient.name,
      normalized_name: ingredient.normalized_name,
      quantity: ingredient.quantity ?? null,
      unit: ingredient.unit ?? null,
      preparation: ingredient.preparation ?? null,
      optional: Boolean(ingredient.optional),
      aisle: ingredient.aisle ?? null,
      ingredient_id: ingredientIds.get(ingredient.normalized_name.trim().toLowerCase()),
    }))
  );
  if (ingredientError) fail(`Could not import ingredients for ${recipe.slug}`, ingredientError);
  importedRecipeIds.push({ id: recipeId, position: recipeIndex });
}

const { error: unlinkError } = await supabase
  .from('recipe_book_recipes')
  .delete()
  .eq('recipe_book_id', bookId);
if (unlinkError) fail('Could not refresh recipe-book links', unlinkError);
const { error: linkError } = await supabase.from('recipe_book_recipes').insert(
  importedRecipeIds.map(recipe => ({ recipe_book_id: bookId, recipe_id: recipe.id, position: recipe.position }))
);
if (linkError) fail('Could not link recipes to the book', linkError);

console.log(`Imported ${importedRecipeIds.length} recipe drafts into “${book.title}”. Human review is still required before publication.`);
