import type { FoodItem, MealSuggestion } from '@/types';
import { getMealsWithStatus, type MealWithStatus } from '@/lib/mealMatching';
import { supabase } from '@/integrations/supabase/client';

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
  const { data, error } = await supabase.functions.invoke('mealdb-proxy', {
    body: null,
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  // supabase.functions.invoke doesn't support query params easily,
  // so we'll use fetch directly with the project URL
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

let cachedAllMeals: MealSuggestion[] | null = null;

const CATEGORIES = [
  'Beef', 'Chicken', 'Dessert', 'Lamb', 'Miscellaneous',
  'Pasta', 'Pork', 'Seafood', 'Side', 'Starter',
  'Vegan', 'Vegetarian', 'Breakfast', 'Goat',
];

async function fetchMealsByCategory(category: string): Promise<MealDbMeal[]> {
  try {
    const data = await mealDbFetch<MealDbResponse>(`filter.php?c=${category}`);
    return data.meals ?? [];
  } catch {
    return [];
  }
}

async function fetchMealDetail(id: string): Promise<MealDbMeal | null> {
  try {
    const data = await mealDbFetch<MealDbResponse>(`lookup.php?i=${id}`);
    return data.meals?.[0] ?? null;
  } catch {
    return null;
  }
}

async function loadAllMeals(): Promise<MealSuggestion[]> {
  if (cachedAllMeals) return cachedAllMeals;

  // Fetch all category listings in parallel
  const listings = await Promise.all(CATEGORIES.map(fetchMealsByCategory));
  const allListings = listings.flat();

  // Dedupe by id
  const uniqueIds = [...new Set(allListings.map(m => m.idMeal))];

  // Fetch full details in batches of 10
  const details: MealSuggestion[] = [];
  for (let i = 0; i < uniqueIds.length; i += 10) {
    const batch = uniqueIds.slice(i, i + 10);
    const results = await Promise.all(batch.map(id => fetchMealDetail(id)));
    for (const meal of results) {
      if (meal) {
        const mapped = mapMeal(meal);
        if (mapped.ingredients.length > 0) {
          details.push(mapped);
        }
      }
    }
  }

  cachedAllMeals = details;
  return details;
}

export async function getTheMealDbRecipeSuggestions(
  inventory: FoodItem[]
): Promise<MealWithStatus[]> {
  try {
    const meals = await loadAllMeals();
    return getMealsWithStatus(inventory, meals);
  } catch (error) {
    console.error('Failed to load TheMealDB recipes', error);
    return [];
  }
}

export async function getTheMealDbRecipeById(
  id: string
): Promise<MealSuggestion | null> {
  try {
    // Try cache first
    if (cachedAllMeals) {
      const cached = cachedAllMeals.find(m => m.id === id);
      if (cached) return cached;
    }

    // Extract numeric id
    const numericId = id.replace('mealdb-', '');
    const meal = await fetchMealDetail(numericId);
    if (!meal) return null;
    return mapMeal(meal);
  } catch (error) {
    console.error('Failed to load TheMealDB recipe by id', error);
    return null;
  }
}
