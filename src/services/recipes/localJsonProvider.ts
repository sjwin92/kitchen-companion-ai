import type { FoodItem, MealSuggestion } from '@/types';
import { getMealsWithStatus, type MealWithStatus } from '@/lib/mealMatching';

let cachedRecipes: MealSuggestion[] | null = null;

export async function loadLocalRecipes(): Promise<MealSuggestion[]> {
  if (cachedRecipes) {
    return cachedRecipes;
  }

  const response = await fetch('/local-recipes.json');

  if (!response.ok) {
    throw new Error(`Failed to load local recipes: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as MealSuggestion[];

  cachedRecipes = Array.isArray(data) ? data : [];
  return cachedRecipes;
}

export async function getLocalRecipeById(id: string): Promise<MealSuggestion | null> {
  const recipes = await loadLocalRecipes();
  return recipes.find(recipe => recipe.id === id) ?? null;
}

export async function getLocalRecipeSuggestions(
  inventory: FoodItem[]
): Promise<MealWithStatus[]> {
  const recipes = await loadLocalRecipes();
  return getMealsWithStatus(inventory, recipes);
}
