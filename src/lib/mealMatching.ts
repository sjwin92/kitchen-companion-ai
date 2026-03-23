import { FoodItem, MealSuggestion } from '@/types';

export type MealWithStatus = MealSuggestion & {
  owned: string[];
  missing: string[];
  matchPercent: number;
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'or', 'of', 'with',
  'fresh', 'large', 'small', 'medium',
  'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded',
  'optional', 'to', 'taste', 'for', 'serving',
  'cup', 'cups', 'tbsp', 'tsp', 'teaspoon', 'teaspoons', 'tablespoon', 'tablespoons',
  'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
  'g', 'kg', 'ml', 'l',
  'can', 'cans', 'jar', 'jars', 'package', 'packages',
  'whole', 'halves', 'half', 'extra', 'virgin'
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toTokens(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .map(token => token.trim())
    .filter(Boolean)
    .map(token => {
      if (token.length > 3 && token.endsWith('es')) return token.slice(0, -2);
      if (token.length > 2 && token.endsWith('s')) return token.slice(0, -1);
      return token;
    })
    .filter(token => !STOP_WORDS.has(token))
    .filter(token => !/^\d+$/.test(token));
}

export function ingredientMatches(ownedName: string, ingredient: string) {
  const ownedNormalized = normalizeText(ownedName);
  const ingredientNormalized = normalizeText(ingredient);

  if (!ownedNormalized || !ingredientNormalized) {
    return false;
  }

  if (
    ownedNormalized.includes(ingredientNormalized) ||
    ingredientNormalized.includes(ownedNormalized)
  ) {
    return true;
  }

  const ownedTokens = toTokens(ownedName);
  const ingredientTokens = toTokens(ingredient);

  if (ownedTokens.length === 0 || ingredientTokens.length === 0) {
    return false;
  }

  const ownedSet = new Set(ownedTokens);
  const overlap = ingredientTokens.filter(token => ownedSet.has(token));

  return overlap.length > 0;
}

export function getMealsWithStatus(
  inventory: FoodItem[],
  meals: MealSuggestion[]
): MealWithStatus[] {
  const availableInventory = inventory.filter(item => item.status !== 'used');

  return meals
    .map(meal => {
      const owned = meal.ingredients.filter(ingredient =>
        availableInventory.some(item => ingredientMatches(item.name, ingredient))
      );

      const missing = meal.ingredients.filter(ingredient =>
        !availableInventory.some(item => ingredientMatches(item.name, ingredient))
      );

      return {
        ...meal,
        owned,
        missing,
        matchPercent: Math.round((owned.length / meal.ingredients.length) * 100),
      };
    })
    .filter(meal => meal.owned.length > 0)
    .sort((a, b) => {
      if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
      if (b.owned.length !== a.owned.length) return b.owned.length - a.owned.length;
      if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
      return a.title.localeCompare(b.title);
    });
}
