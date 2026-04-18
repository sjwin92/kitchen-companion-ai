import type { UserPreferences } from '@/types';

// Ingredients that violate each dietary restriction
export const DIETARY_EXCLUSIONS: Record<string, string[]> = {
  vegan: [
    'chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'cod', 'haddock',
    'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'squid', 'anchov',
    'bacon', 'ham', 'sausage', 'steak', 'turkey', 'duck', 'goose', 'venison',
    'mince', 'minced', 'meatball', 'pepperoni', 'salami', 'chorizo', 'lard', 'suet',
    'egg', 'eggs', 'cheese', 'cream', 'butter', 'milk', 'yogurt', 'yoghurt',
    'honey', 'gelatin', 'gelatine', 'whey', 'casein', 'lactose',
    'mozzarella', 'parmesan', 'cheddar', 'brie', 'feta', 'ricotta', 'mascarpone',
    'crème fraîche', 'creme fraiche', 'sour cream',
  ],
  vegetarian: [
    'chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'cod', 'haddock',
    'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'squid', 'anchov',
    'bacon', 'ham', 'sausage', 'steak', 'turkey', 'duck', 'goose', 'venison',
    'mince', 'minced', 'meatball', 'pepperoni', 'salami', 'chorizo', 'lard', 'suet',
    'gelatin', 'gelatine',
  ],
  'gluten-free': [
    'flour', 'bread', 'pasta', 'wheat', 'barley', 'rye', 'couscous',
    'noodle', 'spaghetti', 'penne', 'fettuccine', 'macaroni', 'linguine', 'orzo',
    'tortilla', 'pita', 'pitta', 'crouton', 'breadcrumb', 'soy sauce', 'bulgur',
    'semolina', 'spelt', 'kamut',
  ],
  'dairy-free': [
    'cheese', 'cream', 'butter', 'milk', 'yogurt', 'yoghurt', 'whey', 'casein',
    'lactose', 'mozzarella', 'parmesan', 'cheddar', 'brie', 'feta', 'ricotta',
    'mascarpone', 'crème fraîche', 'creme fraiche', 'sour cream', 'ghee',
  ],
  keto: [
    'bread', 'pasta', 'rice', 'potato', 'flour', 'sugar', 'honey', 'maple syrup',
    'tortilla', 'noodle', 'couscous', 'oat', 'cereal', 'corn', 'bean', 'lentil',
    'chickpea', 'pea', 'carrot', 'banana', 'apple', 'orange',
  ],
  halal: [
    'pork', 'bacon', 'ham', 'lard', 'suet', 'gelatin', 'gelatine',
    'alcohol', 'wine', 'beer', 'rum', 'bourbon', 'whiskey',
  ],
  kosher: [
    'pork', 'bacon', 'ham', 'lard', 'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'squid',
  ],
};

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

/**
 * Returns TheMealDB search keywords appropriate for the user's dietary preferences.
 */
export function getDietaryKeywordsForSlot(
  slot: string,
  preferences: Pick<UserPreferences, 'dietaryPreferences' | 'preferredCuisines'>,
): string[] {
  const prefs = preferences.dietaryPreferences.map(p => p.toLowerCase());
  const isVegan = prefs.some(p => p.includes('vegan'));
  const isVegetarian = isVegan || prefs.some(p => p.includes('vegetarian'));

  const base = [...(BASE_SLOT_KEYWORDS[slot] ?? [])];
  const meat = isVegan || isVegetarian ? [] : (MEAT_SLOT_KEYWORDS[slot] ?? []);
  const cuisines = preferences.preferredCuisines.slice(0, 2);

  return [...base, ...meat, ...cuisines];
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
  const prefs = preferences.dietaryPreferences.map(p => p.toLowerCase());

  const isVegan = prefs.some(p => p.includes('vegan'));
  const isVegetarian = isVegan || prefs.some(p => p.includes('vegetarian'));
  const isGlutenFree = prefs.some(p => p.includes('gluten'));
  const isDairyFree = prefs.some(p => p.includes('dairy'));
  const isKeto = prefs.some(p => p.includes('keto'));
  const isHalal = prefs.some(p => p.includes('halal'));
  const isKosher = prefs.some(p => p.includes('kosher'));

  const searchText = [name, ...ingredients].join(' ').toLowerCase();

  const containsAny = (terms: string[]) => terms.some(t => searchText.includes(t));

  if (isVegan && containsAny(DIETARY_EXCLUSIONS.vegan)) return false;
  if (isVegetarian && !isVegan && containsAny(DIETARY_EXCLUSIONS.vegetarian)) return false;
  if (isGlutenFree && containsAny(DIETARY_EXCLUSIONS['gluten-free'])) return false;
  if (isDairyFree && containsAny(DIETARY_EXCLUSIONS['dairy-free'])) return false;
  if (isKeto && containsAny(DIETARY_EXCLUSIONS.keto)) return false;
  if (isHalal && containsAny(DIETARY_EXCLUSIONS.halal)) return false;
  if (isKosher && containsAny(DIETARY_EXCLUSIONS.kosher)) return false;

  // Disliked ingredients
  if (preferences.dislikedIngredients.length > 0) {
    const disliked = preferences.dislikedIngredients.map(d => d.toLowerCase());
    if (containsAny(disliked)) return false;
  }

  // Allergies
  if (preferences.allergies.length > 0) {
    const allergies = preferences.allergies.map(a => a.toLowerCase());
    if (containsAny(allergies)) return false;
  }

  return true;
}
