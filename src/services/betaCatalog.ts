import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { CatalogRecipe, MealSuggestion } from '@/types';

const db = supabase as unknown as SupabaseClient;

type CatalogRecipeRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  creator_id: string | null;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  dietary_tags: string[];
  allergen_tags: string[];
  cuisine_tags: string[];
  meal_types: string[];
  nutrition: Record<string, number> | null;
  estimated_cost_low_gbp: number | null;
  estimated_cost_high_gbp: number | null;
  instructions: Array<string | { text?: string }> | null;
  image_path: string | null;
  youtube_url: string | null;
  audio_url: string | null;
  source_type: CatalogRecipe['sourceType'];
  creators: { display_name: string } | null;
  recipe_ingredients: Array<{
    id: string;
    name: string;
    normalized_name: string;
    quantity: number | null;
    unit: string | null;
    optional: boolean;
    aisle: string | null;
  }>;
};

const CATALOG_RECIPE_SELECT = `
  id,slug,title,description,creator_id,servings,prep_minutes,cook_minutes,
  dietary_tags,allergen_tags,cuisine_tags,meal_types,nutrition,
  estimated_cost_low_gbp,estimated_cost_high_gbp,instructions,
  image_path,youtube_url,audio_url,source_type,
  creators(display_name),
  recipe_ingredients(id,name,normalized_name,quantity,unit,optional,aisle)
`;

export function getRecipeMediaUrl(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return supabase.storage.from('recipe-media').getPublicUrl(path).data.publicUrl;
}

function instructionText(value: string | { text?: string }) {
  return typeof value === 'string' ? value : value.text ?? '';
}

function mapCatalogRecipe(row: CatalogRecipeRow): CatalogRecipe {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    creatorId: row.creator_id,
    servings: Number(row.servings),
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    dietaryTags: row.dietary_tags ?? [],
    allergenTags: row.allergen_tags ?? [],
    cuisineTags: row.cuisine_tags ?? [],
    mealTypes: row.meal_types ?? ['dinner'],
    nutrition: row.nutrition ?? {},
    estimatedCostLowGbp: row.estimated_cost_low_gbp === null ? null : Number(row.estimated_cost_low_gbp),
    estimatedCostHighGbp: row.estimated_cost_high_gbp === null ? null : Number(row.estimated_cost_high_gbp),
    ingredients: (row.recipe_ingredients ?? []).map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      normalizedName: ingredient.normalized_name,
      quantity: ingredient.quantity === null ? null : Number(ingredient.quantity),
      unit: ingredient.unit,
      optional: ingredient.optional,
      aisle: ingredient.aisle,
    })),
    instructions: (row.instructions ?? []).map(instructionText).filter(Boolean),
    imagePath: getRecipeMediaUrl(row.image_path),
    youtubeUrl: row.youtube_url,
    audioUrl: row.audio_url,
    creatorName: row.creators?.display_name ?? null,
    sourceType: row.source_type,
  };
}

export async function listCatalogRecipes(): Promise<CatalogRecipe[]> {
  const { data, error } = await db
    .from('recipes')
    .select(CATALOG_RECIPE_SELECT)
    .eq('review_status', 'approved')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as CatalogRecipeRow[]).map(mapCatalogRecipe);
}

export async function getCatalogRecipe(id: string): Promise<CatalogRecipe | null> {
  const { data, error } = await db
    .from('recipes')
    .select(CATALOG_RECIPE_SELECT)
    .eq('id', id)
    .eq('review_status', 'approved')
    .maybeSingle();
  if (error) throw error;
  return data ? mapCatalogRecipe(data as unknown as CatalogRecipeRow) : null;
}

export function catalogRecipeToMealSuggestion(recipe: CatalogRecipe): MealSuggestion {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description ?? '',
    prepTime: `${recipe.prepMinutes + recipe.cookMinutes} min`,
    ingredients: recipe.ingredients.map((ingredient) => ingredient.name),
    measures: recipe.ingredients.map((ingredient) => [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ')),
    image: recipe.imagePath ?? undefined,
    instructions: recipe.instructions.join('\n'),
    category: recipe.dietaryTags[0] ?? 'Recipe',
    area: recipe.cuisineTags[0],
    youtubeUrl: recipe.youtubeUrl ?? undefined,
    servings: recipe.servings,
    nutrition: recipe.nutrition,
    provenance: 'catalogue',
  };
}

type UserRecipeRow = {
  id: string;
  title: string;
  description: string | null;
  image_path: string | null;
  youtube_url: string | null;
  servings: number;
  ingredients: unknown[];
  instructions: string[];
  nutrition: Record<string, number> | null;
  provenance: 'user' | 'ai_assisted' | 'imported';
};

export async function getUserRecipe(id: string): Promise<MealSuggestion | null> {
  const { data, error } = await db
    .from('user_recipes')
    .select('id,title,description,image_path,youtube_url,servings,ingredients,instructions,nutrition,provenance')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const recipe = data as unknown as UserRecipeRow;
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const ingredientNames = ingredients.map((ingredient) =>
    typeof ingredient === 'string'
      ? ingredient
      : ingredient && typeof ingredient === 'object' && typeof (ingredient as { name?: unknown }).name === 'string'
      ? String((ingredient as { name: string }).name)
      : '',
  ).filter(Boolean);
  const measures = ingredients.map((ingredient) => {
    if (!ingredient || typeof ingredient !== 'object') return '';
    const row = ingredient as { quantity?: unknown; unit?: unknown };
    return [row.quantity, row.unit].filter((value) => value !== null && value !== undefined && value !== '').join(' ');
  });
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description ?? '',
    prepTime: 'Flexible',
    ingredients: ingredientNames,
    measures,
    image: getRecipeMediaUrl(recipe.image_path) ?? undefined,
    instructions: Array.isArray(recipe.instructions) ? recipe.instructions.join('\n') : '',
    youtubeUrl: recipe.youtube_url ?? undefined,
    servings: Number(recipe.servings),
    nutrition: recipe.nutrition ?? {},
    provenance: recipe.provenance === 'ai_assisted' ? 'ai_assisted' : 'external',
    category: recipe.provenance === 'ai_assisted' ? 'Private AI draft' : 'Private recipe',
  };
}

export interface CreatorSummary {
  id: string;
  slug: string;
  display_name: string;
  bio: string | null;
  avatar_path: string | null;
  verified: boolean;
}

export interface RecipeBookSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_path: string | null;
  content_version: number;
  access_model: 'included' | 'invite' | 'purchase_future';
  creators: CreatorSummary | null;
}

export interface BookRecipe {
  position: number;
  section_title: string | null;
  recipes: {
    id: string;
    title: string;
    description: string | null;
    image_path: string | null;
    youtube_url: string | null;
    audio_url: string | null;
    servings: number;
    prep_minutes: number;
    cook_minutes: number;
    dietary_tags: string[];
    instructions: Array<{ text?: string } | string>;
    recipe_ingredients: Array<{ id: string; name: string; quantity: number | null; unit: string | null; preparation: string | null }>;
  };
}

export async function listRecipeBooks() {
  const { data, error } = await db
    .from('recipe_books')
    .select('id,slug,title,subtitle,description,cover_path,content_version,access_model,creators(id,slug,display_name,bio,avatar_path,verified)')
    .eq('review_status', 'approved')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as RecipeBookSummary[];
}

export async function getRecipeBook(id: string) {
  const { data: book, error: bookError } = await db
    .from('recipe_books')
    .select('id,slug,title,subtitle,description,cover_path,content_version,access_model,creators(id,slug,display_name,bio,avatar_path,verified)')
    .eq('id', id)
    .single();
  if (bookError) throw bookError;

  const { data: recipes, error: recipesError } = await db
    .from('recipe_book_recipes')
    .select('position,section_title,recipes(id,title,description,image_path,youtube_url,audio_url,servings,prep_minutes,cook_minutes,dietary_tags,instructions,recipe_ingredients(id,name,quantity,unit,preparation))')
    .eq('recipe_book_id', id)
    .order('position');
  if (recipesError) throw recipesError;
  return { book: book as unknown as RecipeBookSummary, recipes: (recipes ?? []) as unknown as BookRecipe[] };
}
