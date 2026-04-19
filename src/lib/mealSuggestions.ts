import type { MealSlot } from '@/hooks/useMealPlans';

export interface SuggestedMeal {
  title: string;
  search_term: string;
  tags?: string[]; // used for dietary filtering
}

const BREAKFAST: SuggestedMeal[] = [
  { title: 'Scrambled Eggs on Toast', search_term: 'scrambled eggs', tags: ['vegetarian'] },
  { title: 'Porridge with Berries', search_term: 'porridge', tags: ['vegetarian', 'vegan'] },
  { title: 'Avocado Toast', search_term: 'avocado toast', tags: ['vegetarian', 'vegan'] },
  { title: 'Yogurt with Granola', search_term: 'granola', tags: ['vegetarian'] },
  { title: 'Pancakes with Maple Syrup', search_term: 'pancakes', tags: ['vegetarian'] },
  { title: 'Full English Breakfast', search_term: 'full english breakfast' },
  { title: 'Poached Eggs on Toast', search_term: 'poached eggs', tags: ['vegetarian'] },
  { title: 'Overnight Oats with Fruit', search_term: 'overnight oats', tags: ['vegetarian', 'vegan'] },
  { title: 'French Toast', search_term: 'french toast', tags: ['vegetarian'] },
  { title: 'Smoked Salmon Bagel', search_term: 'smoked salmon bagel' },
  { title: 'Banana Smoothie Bowl', search_term: 'smoothie bowl', tags: ['vegetarian', 'vegan'] },
  { title: 'Dippy Eggs with Soldiers', search_term: 'boiled eggs', tags: ['vegetarian'] },
];

const LUNCH: SuggestedMeal[] = [
  { title: 'Chicken Caesar Salad', search_term: 'caesar salad' },
  { title: 'Tomato Soup with Crusty Bread', search_term: 'tomato soup', tags: ['vegetarian', 'vegan'] },
  { title: 'BLT Sandwich', search_term: 'blt' },
  { title: 'Jacket Potato with Baked Beans', search_term: 'jacket potato', tags: ['vegetarian'] },
  { title: 'Tuna Pasta Salad', search_term: 'tuna pasta' },
  { title: 'Chicken Wrap', search_term: 'chicken wrap' },
  { title: 'Greek Salad', search_term: 'greek salad', tags: ['vegetarian'] },
  { title: 'Cheese and Ham Toastie', search_term: 'grilled cheese' },
  { title: 'Lentil Soup', search_term: 'lentil soup', tags: ['vegetarian', 'vegan'] },
  { title: 'Egg Mayo Sandwich', search_term: 'egg sandwich', tags: ['vegetarian'] },
  { title: 'Prawn and Avocado Wrap', search_term: 'prawn wrap' },
  { title: 'Minestrone Soup', search_term: 'minestrone', tags: ['vegetarian', 'vegan'] },
  { title: 'Club Sandwich', search_term: 'club sandwich' },
  { title: 'Halloumi and Roasted Veg Wrap', search_term: 'halloumi wrap', tags: ['vegetarian'] },
];

const DINNER: SuggestedMeal[] = [
  { title: 'Spaghetti Bolognese', search_term: 'spaghetti bolognese' },
  { title: 'Chicken Tikka Masala', search_term: 'chicken tikka masala' },
  { title: 'Roast Chicken with Vegetables', search_term: 'roast chicken' },
  { title: 'Fish and Chips', search_term: 'fish chips' },
  { title: 'Beef Stir Fry with Noodles', search_term: 'beef stir fry' },
  { title: 'Lamb Rogan Josh', search_term: 'lamb curry' },
  { title: 'Salmon with Roasted Vegetables', search_term: 'baked salmon' },
  { title: 'Chicken Pasta Bake', search_term: 'pasta bake' },
  { title: 'Mushroom Risotto', search_term: 'mushroom risotto', tags: ['vegetarian'] },
  { title: 'Homemade Beef Burger', search_term: 'beef burger' },
  { title: 'Prawn Fried Rice', search_term: 'prawn fried rice' },
  { title: 'Lasagne', search_term: 'lasagne' },
  { title: 'Chicken Fajitas', search_term: 'chicken fajitas' },
  { title: 'Vegetable Curry', search_term: 'vegetable curry', tags: ['vegetarian', 'vegan'] },
  { title: "Shepherd's Pie", search_term: 'shepherds pie' },
  { title: 'Beef Chilli con Carne', search_term: 'chilli con carne' },
  { title: 'Thai Green Chicken Curry', search_term: 'thai green curry' },
  { title: 'Chicken Casserole', search_term: 'chicken casserole' },
  { title: 'Prawn Linguine', search_term: 'prawn pasta' },
  { title: 'Pork Stir Fry', search_term: 'pork stir fry' },
  { title: 'Vegetable Lasagne', search_term: 'vegetable lasagne', tags: ['vegetarian'] },
  { title: 'Chicken Katsu Curry', search_term: 'katsu curry' },
  { title: 'Baked Cod with Lemon', search_term: 'baked cod' },
  { title: 'Lemon Garlic Pasta', search_term: 'lemon pasta', tags: ['vegetarian'] },
  { title: 'Slow-Cooked Beef Stew', search_term: 'beef stew' },
  { title: 'Teriyaki Salmon', search_term: 'teriyaki salmon' },
  { title: 'Chicken Shawarma', search_term: 'chicken shawarma' },
  { title: 'Sausage and Mash', search_term: 'sausage mash' },
  { title: 'Pad Thai', search_term: 'pad thai' },
  { title: 'Moussaka', search_term: 'moussaka' },
];

const BY_SLOT: Record<string, SuggestedMeal[]> = {
  breakfast: BREAKFAST,
  lunch: LUNCH,
  dinner: DINNER,
  snack: BREAKFAST, // fallback
};

/**
 * Pick a random meal for the given slot, avoiding titles already in the plan.
 * Optionally filter to meals matching a dietary tag (e.g. 'vegetarian').
 */
export function pickMeal(
  slot: MealSlot,
  alreadyPlanned: string[],
  dietaryTag?: string,
): SuggestedMeal {
  const pool = BY_SLOT[slot] ?? DINNER;
  const used = new Set(alreadyPlanned.map(t => t.toLowerCase()));

  let filtered = pool.filter(m => !used.has(m.title.toLowerCase()));
  if (dietaryTag) {
    const tagged = filtered.filter(m => m.tags?.includes(dietaryTag));
    if (tagged.length > 0) filtered = tagged;
  }
  if (filtered.length === 0) filtered = pool; // fallback: allow repeats

  return filtered[Math.floor(Math.random() * filtered.length)];
}
