import { FoodItem, MealSuggestion } from '@/types';
import type { MealWithStatus } from '@/lib/mealMatching';
import { getLocalRecipeById } from './localJsonProvider';
import { getMealieRecipeById } from './mealieProvider';
import { getTheMealDbRecipeById } from './theMealDbProvider';
import { catalogRecipeToMealSuggestion, getCatalogRecipe, getUserRecipe, listCatalogRecipes, listRecommendedCatalogRecipes } from '@/services/betaCatalog';

export type RecipeSource = 'local' | 'mealie' | 'themealdb' | 'hybrid';

const env = import.meta.env as Record<string, string | undefined>;

export function getRequestedRecipeSource(): string {
  return (env.VITE_RECIPE_SOURCE ?? 'hybrid').trim();
}

export function getConfiguredRecipeSource(): RecipeSource {
  const source = getRequestedRecipeSource();
  if (source === 'mealie') return 'mealie';
  if (source === 'local') return 'local';
  if (source === 'themealdb') return 'themealdb';
  return 'hybrid';
}

export function hasValidRecipeSourceConfig(): boolean {
  const value = getRequestedRecipeSource();
  return ['', 'local', 'mealie', 'mock', 'themealdb', 'hybrid'].includes(value);
}

async function getHybridRecipeById(id: string): Promise<MealSuggestion | null> {
  // Route by ID prefix
  if (id.startsWith('local-')) return getLocalRecipeById(id);
  if (id.startsWith('mealdb-')) return getTheMealDbRecipeById(id);

  // Fallback: try both
  const local = await getLocalRecipeById(id);
  if (local) return local;
  return getTheMealDbRecipeById(id);
}

export async function getRecipeSuggestions(
  _inventory: FoodItem[],
  _source: RecipeSource = getConfiguredRecipeSource()
): Promise<MealWithStatus[]> {
  const ranked = await listRecommendedCatalogRecipes({ limit: 30 });
  return ranked.map(({ recipe, reasons, missingIngredients, matchedCount }) => {
    const meal = catalogRecipeToMealSuggestion(recipe);
    const missingIds = new Set(missingIngredients.map(ingredient => ingredient.id));
    const required = recipe.ingredients.filter(ingredient => !ingredient.optional);
    return {
      ...meal,
      owned: required.filter(ingredient => !missingIds.has(ingredient.id)).map(ingredient => ingredient.name),
      missing: missingIngredients.map(ingredient => ingredient.name),
      matchPercent: required.length === 0 ? 100 : Math.round(((matchedCount ?? required.length - missingIngredients.length) / required.length) * 100),
      reasons,
    };
  });
}

export async function getRecipeById(
  id: string,
  source: RecipeSource = getConfiguredRecipeSource()
): Promise<MealSuggestion | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    const catalogRecipe = await getCatalogRecipe(id);
    if (catalogRecipe) return catalogRecipeToMealSuggestion(catalogRecipe);
    const userRecipe = await getUserRecipe(id);
    if (userRecipe) return userRecipe;
  }
  if (source === 'mealie') return getMealieRecipeById(id);
  if (source === 'local') return getLocalRecipeById(id);
  if (source === 'themealdb') return getTheMealDbRecipeById(id);
  return getHybridRecipeById(id);
}

/**
 * Search recipes by title/keyword. Returns MealSuggestion[] for display.
 * Uses TheMealDB search + local fallback.
 */
export async function searchRecipes(query: string): Promise<MealSuggestion[]> {
  try {
    const catalog = await listCatalogRecipes();
    const normalizedQuery = query.trim().toLowerCase();
    return catalog
      .filter((recipe) =>
        recipe.title.toLowerCase().includes(normalizedQuery)
        || recipe.cuisineTags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
        || recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(normalizedQuery))
      )
      .slice(0, 8)
      .map(catalogRecipeToMealSuggestion);
  } catch {
    return [];
  }
}
