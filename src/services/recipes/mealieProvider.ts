import { FoodItem, MealSuggestion } from '@/types';
import { getMealsWithStatus, MealWithStatus } from '@/lib/mealMatching';

type MealieIngredient = {
  food?: { name?: string | null } | null;
  name?: string | null;
  note?: string | null;
  display?: string | null;
  displayAs?: string | null;
  display_as?: string | null;
  originalText?: string | null;
  original_text?: string | null;
};

type MealieRecipe = {
  id?: string | number;
  slug?: string;
  name?: string;
  description?: string | null;
  prepTime?: string | null;
  totalTime?: string | null;
  recipeIngredient?: MealieIngredient[] | null;
  recipe_ingredient?: MealieIngredient[] | null;
};

type MealieListResponse = {
  data?: MealieRecipe[];
  items?: MealieRecipe[];
};

const env = import.meta.env as Record<string, string | undefined>;

const MEALIE_BASE_URL = (env.VITE_MEALIE_BASE_URL ?? '').trim().replace(/\/$/, '');
const MEALIE_API_TOKEN = (env.VITE_MEALIE_API_TOKEN ?? '').trim();

export function hasMealieConfig(): boolean {
  return Boolean(MEALIE_BASE_URL && MEALIE_API_TOKEN);
}

export function getMealieConfigSummary(): string {
  if (!MEALIE_BASE_URL && !MEALIE_API_TOKEN) {
    return 'Mealie base URL and API token are missing.';
  }

  if (!MEALIE_BASE_URL) {
    return 'Mealie base URL is missing.';
  }

  if (!MEALIE_API_TOKEN) {
    return 'Mealie API token is missing.';
  }

  return 'Mealie configured.';
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function formatDuration(value?: string | null): string {
  if (!hasText(value)) {
    return '30 min';
  }

  const isoMatch = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);

  if (!isoMatch) {
    return value.trim();
  }

  const hours = Number(isoMatch[1] ?? 0);
  const minutes = Number(isoMatch[2] ?? 0);
  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes <= 0) {
    return '30 min';
  }

  return `${totalMinutes} min`;
}

function getHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${MEALIE_API_TOKEN}`,
  };
}

async function mealieFetch<T>(path: string): Promise<T> {
  const url = new URL(path, `${MEALIE_BASE_URL}/`);

  const response = await fetch(url.toString(), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Mealie request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function extractIngredientNames(recipe: MealieRecipe): string[] {
  const ingredients = recipe.recipeIngredient ?? recipe.recipe_ingredient ?? [];

  return ingredients
    .map((ingredient) => {
      const value =
        ingredient.food?.name ??
        ingredient.name ??
        ingredient.displayAs ??
        ingredient.display_as ??
        ingredient.originalText ??
        ingredient.original_text ??
        ingredient.display ??
        ingredient.note;

      return hasText(value) ? value.trim() : '';
    })
    .filter(Boolean);
}

function mapMealieRecipe(recipe: MealieRecipe): MealSuggestion | null {
  if (!hasText(recipe.name)) {
    return null;
  }

  const ingredients = extractIngredientNames(recipe);

  if (ingredients.length === 0) {
    return null;
  }

  return {
    id: String(recipe.id ?? recipe.slug ?? recipe.name.trim()),
    title: recipe.name.trim(),
    description: hasText(recipe.description)
      ? recipe.description.trim()
      : 'Imported from Mealie.',
    prepTime: formatDuration(recipe.prepTime ?? recipe.totalTime),
    ingredients,
  };
}

async function fetchRecipeList(): Promise<MealieRecipe[]> {
  if (!hasMealieConfig()) {
    console.warn('Mealie provider skipped:', getMealieConfigSummary());
    return [];
  }

  const payload = await mealieFetch<MealieListResponse | MealieRecipe[]>(
    '/api/recipes?perPage=-1&orderBy=name&orderDirection=asc'
  );

  if (Array.isArray(payload)) {
    return payload;
  }

  return payload.data ?? payload.items ?? [];
}

async function hydrateRecipeIfNeeded(recipe: MealieRecipe): Promise<MealieRecipe> {
  const ingredientCount =
    recipe.recipeIngredient?.length ?? recipe.recipe_ingredient?.length ?? 0;

  if (ingredientCount > 0 || !hasText(recipe.slug)) {
    return recipe;
  }

  try {
    return await mealieFetch<MealieRecipe>(`/api/recipes/${recipe.slug}`);
  } catch (error) {
    console.warn('Failed to hydrate Mealie recipe details', recipe.slug, error);
    return recipe;
  }
}

export async function getMealieRecipeById(id: string): Promise<MealSuggestion | null> {
  try {
    const list = await fetchRecipeList();
    const baseRecipe =
      list.find(recipe => String(recipe.id ?? recipe.slug ?? recipe.name ?? '') === id) ?? null;

    if (!baseRecipe) {
      return null;
    }

    const detailedRecipe = await hydrateRecipeIfNeeded(baseRecipe);
    return mapMealieRecipe(detailedRecipe);
  } catch (error) {
    console.error('Failed to load Mealie recipe by id', error);
    return null;
  }
}

export async function getMealieRecipeSuggestions(
  inventory: FoodItem[]
): Promise<MealWithStatus[]> {
  try {
    const list = await fetchRecipeList();
    const detailedRecipes = await Promise.all(list.map(hydrateRecipeIfNeeded));

    const meals = detailedRecipes
      .map(mapMealieRecipe)
      .filter((meal): meal is MealSuggestion => meal !== null);

    return getMealsWithStatus(inventory, meals);
  } catch (error) {
    console.error('Failed to load Mealie recipes', error);
    return [];
  }
}
