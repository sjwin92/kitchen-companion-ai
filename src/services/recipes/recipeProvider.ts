import { FoodItem, MealSuggestion } from '@/types';
import { type MealWithStatus } from '@/lib/mealMatching';
import { getLocalRecipeById, getLocalRecipeSuggestions } from './localJsonProvider';
import { getMealieRecipeById, getMealieRecipeSuggestions } from './mealieProvider';

export type RecipeSource = 'local' | 'mealie';

const env = import.meta.env as Record<string, string | undefined>;

export function getRequestedRecipeSource(): string {
  return (env.VITE_RECIPE_SOURCE ?? 'local').trim();
}

export function getConfiguredRecipeSource(): RecipeSource {
  const source = getRequestedRecipeSource();

  if (source === 'mealie') {
    return 'mealie';
  }

  return 'local';
}

export function hasValidRecipeSourceConfig(): boolean {
  const value = getRequestedRecipeSource();
  return value === '' || value === 'local' || value === 'mealie' || value === 'mock';
}

export async function getRecipeSuggestions(
  inventory: FoodItem[],
  source: RecipeSource = getConfiguredRecipeSource()
): Promise<MealWithStatus[]> {
  if (source === 'mealie') {
    return getMealieRecipeSuggestions(inventory);
  }

  return getLocalRecipeSuggestions(inventory);
}

export async function getRecipeById(
  id: string,
  source: RecipeSource = getConfiguredRecipeSource()
): Promise<MealSuggestion | null> {
  if (source === 'mealie') {
    return getMealieRecipeById(id);
  }

  return getLocalRecipeById(id);
}
