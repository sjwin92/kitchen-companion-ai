export const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Keto',
  'Halal',
  'Kosher',
  'None',
] as const;

export const COMMON_DISLIKES = [
  'Cilantro',
  'Mushrooms',
  'Olives',
  'Anchovies',
  'Blue Cheese',
  'Liver',
  'Eggplant',
] as const;

const DIETARY_REDUNDANT_DISLIKES: Record<string, readonly string[]> = {
  vegan: ['Anchovies', 'Blue Cheese', 'Liver'],
  vegetarian: ['Anchovies', 'Liver'],
  'dairy-free': ['Blue Cheese'],
};

export function toggleDietaryPreference(current: string[], option: string): string[] {
  if (option === 'None') return current.includes('None') ? [] : ['None'];

  const withoutNone = current.filter((item) => item !== 'None');
  return withoutNone.includes(option)
    ? withoutNone.filter((item) => item !== option)
    : [...withoutNone, option];
}

export function getSuggestedDislikes(dietaryPreferences: string[]): string[] {
  const redundant = new Set(
    dietaryPreferences.flatMap(
      (preference) => DIETARY_REDUNDANT_DISLIKES[preference.toLowerCase()] ?? [],
    ),
  );

  return COMMON_DISLIKES.filter((ingredient) => !redundant.has(ingredient));
}

export function removeRedundantDislikes(
  dislikedIngredients: string[],
  dietaryPreferences: string[],
): string[] {
  const suggestions = new Set(getSuggestedDislikes(dietaryPreferences));
  const common = new Set<string>(COMMON_DISLIKES);
  return dislikedIngredients.filter((ingredient) => !common.has(ingredient) || suggestions.has(ingredient));
}
