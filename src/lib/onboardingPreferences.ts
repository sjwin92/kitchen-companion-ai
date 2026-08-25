import {
  DIETARY_OPTIONS,
  dietExcludesFood,
} from '../../supabase/functions/_shared/dietary-rules';

export { DIETARY_OPTIONS };

export const COMMON_DISLIKES = [
  'Cilantro',
  'Mushrooms',
  'Olives',
  'Anchovies',
  'Blue Cheese',
  'Liver',
  'Eggplant',
] as const;

export function toggleDietaryPreference(current: string[], option: string): string[] {
  if (option === 'None') return current.includes('None') ? [] : ['None'];

  const withoutNone = current.filter((item) => item !== 'None');
  return withoutNone.includes(option)
    ? withoutNone.filter((item) => item !== option)
    : [...withoutNone, option];
}

export function getSuggestedDislikes(dietaryPreferences: string[]): string[] {
  return COMMON_DISLIKES.filter((ingredient) => !dietExcludesFood(ingredient, dietaryPreferences));
}

export function removeRedundantDislikes(
  dislikedIngredients: string[],
  dietaryPreferences: string[],
): string[] {
  return dislikedIngredients.filter((ingredient) => !dietExcludesFood(ingredient, dietaryPreferences));
}
