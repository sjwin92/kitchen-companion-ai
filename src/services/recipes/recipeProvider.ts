import { FoodItem, MealSuggestion } from '@/types';
import { type MealWithStatus } from '@/lib/mealMatching';
import { getLocalRecipeById, getLocalRecipeSuggestions } from './localJsonProvider';
import { getMealieRecipeById, getMealieRecipeSuggestions } from './mealieProvider';
import { getTheMealDbRecipeById, getTheMealDbRecipeSuggestions } from './theMealDbProvider';

export type RecipeSource = 'local' | 'mealie' | 'themealdb';

const env = import.meta.env as Record<string, string | undefined>;

export function getRequestedRecipeSource(): string {
  return (env.VITE_RECIPE_SOURCE ?? 'themealdb').trim();
}

export function getConfiguredRecipeSource(): RecipeSource {
  const source = getRequestedRecipeSource();

  if (source === 'mealie') return 'mealie';
  if (source === 'local') return 'local';

  return 'themealdb';
}

export function hasValidRecipeSourceConfig(): boolean {
  const value = getRequestedRecipeSource();
  return value === '' || value === 'local' || value === 'mealie' || value === 'mock' || value === 'themealdb';
}

export async function getRecipeSuggestions(
  inventory: FoodItem[],
  source: RecipeSource = getConfiguredRecipeSource()
): Promise<MealWithStatus[]> {
  if (source === 'mealie') return getMealieRecipeSuggestions(inventory);
  if (source === 'local') return getLocalRecipeSuggestions(inventory);
  return getTheMealDbRecipeSuggestions(inventory);
}

export async function getRecipeById(
  id: string,
  source: RecipeSource = getConfiguredRecipeSource()
): Promise<MealSuggestion | null> {
  if (source === 'mealie') return getMealieRecipeById(id);
  if (source === 'local') return getLocalRecipeById(id);
  return getTheMealDbRecipeById(id);
}
