import { supabase } from '@/integrations/supabase/client';

// Cheaper-alternative suggestions for pricey items
export const CHEAPER_ALTERNATIVES: Record<string, string> = {
  salmon: 'mackerel',
  prawns: 'tuna',
  cod: 'pollock',
  'beef mince': 'pork mince',
  parmesan: 'cheddar',
  'pine nuts': 'sunflower seeds',
  almonds: 'peanuts',
  cashews: 'peanuts',
  'greek yogurt': 'natural yogurt',
  'sweet potato': 'potato',
  'basmati rice': 'long grain rice',
  'olive oil': 'vegetable oil',
};

// Aisle categorization (more granular than current)
export type Aisle = 'Produce' | 'Meat & Fish' | 'Dairy & Eggs' | 'Pantry' | 'Frozen' | 'Bakery' | 'Other';

const AISLE_KEYWORDS: Record<Aisle, string[]> = {
  Produce: ['tomato', 'onion', 'garlic', 'pepper', 'carrot', 'potato', 'spinach', 'kale', 'lettuce', 'zucchini', 'courgette', 'broccoli', 'cauliflower', 'mushroom', 'celery', 'cucumber', 'avocado', 'lemon', 'lime', 'parsley', 'cilantro', 'coriander', 'basil', 'mint', 'herb', 'apple', 'banana', 'orange', 'berry', 'berries', 'grape', 'ginger', 'chilli', 'leek', 'cabbage'],
  'Meat & Fish': ['chicken', 'beef', 'pork', 'lamb', 'mince', 'bacon', 'sausage', 'salmon', 'tuna', 'cod', 'mackerel', 'prawn', 'fish', 'turkey', 'ham'],
  'Dairy & Eggs': ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'ricotta', 'mozzarella', 'parmesan', 'cheddar', 'feta', 'egg'],
  Pantry: ['rice', 'pasta', 'flour', 'sugar', 'salt', 'oil', 'vinegar', 'sauce', 'spice', 'can', 'bean', 'lentil', 'stock', 'broth', 'honey', 'peanut', 'oat', 'cereal', 'almond', 'cashew', 'noodle', 'tofu', 'soy', 'coconut milk', 'chickpea', 'passata'],
  Frozen: ['frozen', 'ice cream'],
  Bakery: ['bread', 'bagel', 'roll', 'pastry', 'croissant', 'pita'],
  Other: [],
};

export function getAisle(name: string): Aisle {
  const n = name.toLowerCase();
  for (const aisle of ['Meat & Fish', 'Dairy & Eggs', 'Produce', 'Bakery', 'Frozen', 'Pantry'] as Aisle[]) {
    if (AISLE_KEYWORDS[aisle].some(k => n.includes(k))) return aisle;
  }
  return 'Other';
}

export function getCheaperAlternative(name: string): string | null {
  const n = name.toLowerCase().trim();
  for (const [pricey, cheap] of Object.entries(CHEAPER_ALTERNATIVES)) {
    if (n.includes(pricey)) return cheap;
  }
  return null;
}

export interface PriceLookup {
  prices: Map<string, number>;
}

export async function fetchPricesFor(itemNames: string[]): Promise<Map<string, number>> {
  if (itemNames.length === 0) return new Map();
  const { data } = await supabase
    .from('ingredient_prices')
    .select('ingredient_name, estimated_price_gbp');
  const map = new Map<string, number>();
  if (!data) return map;
  // Match by substring — shopping list names won't exactly match price keys
  for (const item of itemNames) {
    const n = item.toLowerCase().trim();
    let best: { key: string; price: number } | null = null;
    for (const row of data) {
      const key = row.ingredient_name.toLowerCase();
      if (n === key || n.includes(key) || key.includes(n)) {
        // Prefer longest (most specific) match
        if (!best || key.length > best.key.length) {
          best = { key, price: Number(row.estimated_price_gbp) };
        }
      }
    }
    if (best) map.set(item, best.price);
  }
  return map;
}
