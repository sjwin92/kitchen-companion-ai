import { FoodItem, MealSuggestion } from '@/types';
import { getMealsWithStatus, type MealWithStatus } from '@/lib/mealMatching';
import { getLocalRecipeById, getLocalRecipeSuggestions, loadLocalRecipes } from './localJsonProvider';
import { getMealieRecipeById, getMealieRecipeSuggestions } from './mealieProvider';
import { getTheMealDbRecipeById, getTheMealDbRecipeSuggestions } from './theMealDbProvider';

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

/**
 * Hybrid provider: merges local Kaggle recipes with TheMealDB results,
 * deduplicates by normalized title, and sorts by pantry match %.
 */
async function getHybridSuggestions(inventory: FoodItem[]): Promise<MealWithStatus[]> {
  // Fetch both sources in parallel
  const [localResults, mealDbResults] = await Promise.allSettled([
    getLocalRecipeSuggestions(inventory),
    getTheMealDbRecipeSuggestions(inventory),
  ]);

  const local = localResults.status === 'fulfilled' ? localResults.value : [];
  const mealDb = mealDbResults.status === 'fulfilled' ? mealDbResults.value : [];

  // Deduplicate by normalized title — prefer MealDB (has images/video)
  const seen = new Map<string, MealWithStatus>();

  for (const meal of mealDb) {
    seen.set(meal.title.toLowerCase().trim(), meal);
  }
  for (const meal of local) {
    const key = meal.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, meal);
    }
  }

  // Sort by match % descending, then by owned count
  return [...seen.values()].sort((a, b) => {
    if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
    if (b.owned.length !== a.owned.length) return b.owned.length - a.owned.length;
    return a.missing.length - b.missing.length;
  });
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
  inventory: FoodItem[],
  source: RecipeSource = getConfiguredRecipeSource()
): Promise<MealWithStatus[]> {
  if (source === 'mealie') return getMealieRecipeSuggestions(inventory);
  if (source === 'local') return getLocalRecipeSuggestions(inventory);
  if (source === 'themealdb') return getTheMealDbRecipeSuggestions(inventory);
  return getHybridSuggestions(inventory);
}

export async function getRecipeById(
  id: string,
  source: RecipeSource = getConfiguredRecipeSource()
): Promise<MealSuggestion | null> {
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
  const projectId = (import.meta.env as Record<string, string | undefined>).VITE_SUPABASE_PROJECT_ID;
  const anonKey = (import.meta.env as Record<string, string | undefined>).VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!projectId || !anonKey) return [];

  try {
    const url = `https://${projectId}.supabase.co/functions/v1/mealdb-proxy?path=${encodeURIComponent(`search.php?s=${query}`)}`;
    const res = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    const data = await res.json();
    if (data?.meals?.length) {
      return data.meals.map((m: any) => ({
        id: `mealdb-${m.idMeal}`,
        title: m.strMeal,
        image: m.strMealThumb,
        ingredients: [],
        instructions: '',
        category: m.strCategory ?? '',
      }));
    }
  } catch { /* fallback below */ }

  // Fallback: search local recipes
  const local = await loadLocalRecipes();
  const q = query.toLowerCase();
  return local
    .filter(r => r.title.toLowerCase().includes(q))
    .slice(0, 5)
    .map(r => ({ ...r, ingredients: r.ingredients ?? [], instructions: r.instructions ?? '' }));
}
