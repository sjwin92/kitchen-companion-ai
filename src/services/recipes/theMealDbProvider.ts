import type { FoodItem, MealSuggestion } from '@/types';
import { getMealsWithStatus, type MealWithStatus } from '@/lib/mealMatching';

type MealDbMeal = {
  idMeal: string;
  strMeal: string;
  strCategory?: string;
  strArea?: string;
  strInstructions?: string;
  strMealThumb?: string;
  strYoutube?: string;
  [key: string]: string | undefined | null;
};

type MealDbResponse = {
  meals: MealDbMeal[] | null;
};

async function mealDbFetch<T>(path: string): Promise<T> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const url = `https://${projectId}.supabase.co/functions/v1/mealdb-proxy?path=${encodeURIComponent(path)}`;
  const response = await fetch(url, {
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`MealDB proxy failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function extractIngredients(meal: MealDbMeal): string[] {
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    if (ing && ing.trim()) {
      ingredients.push(ing.trim());
    }
  }
  return ingredients;
}

function mapMeal(meal: MealDbMeal): MealSuggestion {
  return {
    id: `mealdb-${meal.idMeal}`,
    title: meal.strMeal,
    description: meal.strInstructions?.trim() || '',
    prepTime: '30 min',
    ingredients: extractIngredients(meal),
    image: meal.strMealThumb || undefined,
    instructions: meal.strInstructions?.trim() || undefined,
    category: meal.strCategory || undefined,
    area: meal.strArea || undefined,
    youtubeUrl: meal.strYoutube || undefined,
  };
}

// Cache full meal details by ID to avoid re-fetching
const detailCache = new Map<string, MealSuggestion>();

async function fetchMealsByIngredient(ingredient: string): Promise<string[]> {
  try {
    const data = await mealDbFetch<MealDbResponse>(
      `filter.php?i=${encodeURIComponent(ingredient)}`
    );
    return (data.meals ?? []).map(m => m.idMeal);
  } catch {
    return [];
  }
}

async function fetchMealDetail(id: string): Promise<MealSuggestion | null> {
  if (detailCache.has(id)) return detailCache.get(id)!;
  try {
    const data = await mealDbFetch<MealDbResponse>(`lookup.php?i=${id}`);
    const raw = data.meals?.[0];
    if (!raw) return null;
    const mapped = mapMeal(raw);
    if (mapped.ingredients.length > 0) {
      detailCache.set(mapped.id, mapped);
      return mapped;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Optimised flow:
 * 1. For each inventory item, call filter.php?i=<ingredient> (parallel, ~5-15 calls)
 * 2. Deduplicate the returned meal IDs
 * 3. Fetch full details only for matched meals (parallel batches of 15)
 */
export async function getTheMealDbRecipeSuggestions(
  inventory: FoodItem[]
): Promise<MealWithStatus[]> {
  try {
    const available = inventory.filter(i => (i.status as string) !== 'used');
    if (available.length === 0) return [];

    // Normalise inventory names to simple search terms
    const searchTerms = [...new Set(
      available.map(item =>
        item.name.toLowerCase().replace(/[^a-z ]/g, '').trim().split(' ')[0]
      ).filter(t => t.length >= 3)
    )];

    // 1. Search by ingredient – all in parallel
    const idArrays = await Promise.all(searchTerms.map(fetchMealsByIngredient));
    const uniqueIds = [...new Set(idArrays.flat())];

    if (uniqueIds.length === 0) return [];

    // 2. Fetch details in parallel batches of 15
    const meals: MealSuggestion[] = [];
    const BATCH = 15;
    for (let i = 0; i < uniqueIds.length; i += BATCH) {
      const batch = uniqueIds.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(fetchMealDetail));
      for (const m of results) {
        if (m) meals.push(m);
      }
    }

    return getMealsWithStatus(inventory, meals);
  } catch (error) {
    console.error('Failed to load TheMealDB recipes', error);
    return [];
  }
}

export async function getTheMealDbRecipeById(
  id: string
): Promise<MealSuggestion | null> {
  // Check detail cache
  if (detailCache.has(id)) return detailCache.get(id)!;

  const numericId = id.replace('mealdb-', '');
  return fetchMealDetail(numericId);
}
