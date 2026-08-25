import type { UserPreferences } from '@/types';
import {
  dietaryRuleKey,
  findDietaryConflicts,
  foodTextMatchesTerm,
} from '../../supabase/functions/_shared/dietary-rules';

// Slot keywords that respect dietary preferences
const BASE_SLOT_KEYWORDS: Record<string, string[]> = {
  breakfast: ['pancake', 'porridge', 'omelette', 'smoothie', 'granola'],
  lunch: ['salad', 'soup', 'sandwich', 'wrap', 'rice'],
  dinner: ['pasta', 'curry', 'stir fry', 'casserole', 'risotto'],
  snack: ['cookie', 'fruit', 'yogurt', 'smoothie', 'cake'],
};

const MEAT_SLOT_KEYWORDS: Record<string, string[]> = {
  lunch: ['chicken', 'beef', 'lamb', 'tuna'],
  dinner: ['chicken', 'beef', 'steak', 'salmon'],
  snack: [],
  breakfast: [],
};

const PESCATARIAN_SLOT_KEYWORDS: Record<string, string[]> = {
  lunch: ['tuna', 'salmon'],
  dinner: ['salmon', 'cod', 'prawn'],
  snack: [],
  breakfast: [],
};

/**
 * Returns TheMealDB search keywords appropriate for the user's dietary preferences.
 */
export function getDietaryKeywordsForSlot(
  slot: string,
  preferences: Pick<UserPreferences, 'dietaryPreferences' | 'preferredCuisines'>,
): string[] {
  const prefs = preferences.dietaryPreferences.map(dietaryRuleKey);
  const isVegan = prefs.includes('vegan');
  const isVegetarian = isVegan || prefs.includes('vegetarian');
  const isPescatarian = prefs.includes('pescatarian');

  const base = [...(BASE_SLOT_KEYWORDS[slot] ?? [])];
  const proteinKeywords = isVegan || isVegetarian
    ? []
    : isPescatarian
    ? (PESCATARIAN_SLOT_KEYWORDS[slot] ?? [])
    : (MEAT_SLOT_KEYWORDS[slot] ?? []);
  const cuisines = preferences.preferredCuisines.slice(0, 2);

  return [...base, ...proteinKeywords, ...cuisines];
}

/**
 * Returns true if the item passes all the user's dietary filters.
 * Checks against both the name/title AND a list of ingredient strings.
 */
export function passesUserDietaryFilters(
  name: string,
  ingredients: string[],
  preferences: Pick<UserPreferences, 'dietaryPreferences' | 'dislikedIngredients' | 'allergies'>,
): boolean {
  const foods = [name, ...ingredients];
  if (findDietaryConflicts(foods, preferences.dietaryPreferences).length > 0) return false;

  // Disliked ingredients
  if (preferences.dislikedIngredients.length > 0) {
    if (foods.some((food) => preferences.dislikedIngredients.some((dislike) => foodTextMatchesTerm(food, dislike)))) return false;
  }

  // Allergies
  if (preferences.allergies.length > 0) {
    if (foods.some((food) => preferences.allergies.some((allergy) => foodTextMatchesTerm(food, allergy)))) return false;
  }

  return true;
}
