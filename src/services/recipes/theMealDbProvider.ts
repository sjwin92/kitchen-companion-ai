import type { FoodItem, MealSuggestion } from '@/types';
import { getMealsWithStatus, type MealWithStatus } from '@/lib/mealMatching';

const BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

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
  const res = await fetch(`${BASE_URL}/filter.php?c=${category}`);
  if (!res.ok) return [];
  const data = (await res.json()) as MealDbResponse;
  return data.meals ?? [];
}

async function fetchMealDetail(id: string): Promise<MealDbMeal | null> {
  const res = await fetch(`${BASE_URL}/lookup.php?i=${id}`);
  if (!res.ok) return null;
  const data = (await res.json()) as MealDbResponse;
  return data.meals?.[0] ?? null;
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
