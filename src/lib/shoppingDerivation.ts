import { ingredientMatches } from '@/lib/mealMatching';

export interface RequiredIngredient {
  name: string;
  normalizedName?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  optional?: boolean;
  mealTitle: string;
}

export interface AggregatedIngredient {
  name: string;
  normalizedName: string;
  quantity: string;
  fromMeals: string[];
}

export function normalizeIngredientName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function numericQuantity(value: RequiredIngredient['quantity']): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null;
  return Number(trimmed);
}

function displayNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

export function aggregateIngredients(ingredients: RequiredIngredient[]): AggregatedIngredient[] {
  const grouped = new Map<string, {
    name: string;
    normalizedName: string;
    unit: string;
    numericTotal: number | null;
    fallbackQuantities: string[];
    fromMeals: Set<string>;
  }>();

  for (const ingredient of ingredients) {
    if (ingredient.optional) continue;
    const normalizedName = normalizeIngredientName(ingredient.normalizedName || ingredient.name);
    if (!normalizedName) continue;
    const unit = (ingredient.unit || '').trim().toLowerCase();
    const key = `${normalizedName}::${unit}`;
    const quantity = numericQuantity(ingredient.quantity);
    const fallback = typeof ingredient.quantity === 'string' ? ingredient.quantity.trim() : '';
    const existing = grouped.get(key);

    if (existing) {
      existing.fromMeals.add(ingredient.mealTitle);
      if (quantity !== null && existing.numericTotal !== null) existing.numericTotal += quantity;
      else if (fallback) {
        existing.numericTotal = null;
        if (!existing.fallbackQuantities.includes(fallback)) existing.fallbackQuantities.push(fallback);
      }
      continue;
    }

    grouped.set(key, {
      name: ingredient.name.trim(),
      normalizedName,
      unit,
      numericTotal: quantity,
      fallbackQuantities: fallback ? [fallback] : [],
      fromMeals: new Set([ingredient.mealTitle]),
    });
  }

  return [...grouped.values()].map((ingredient) => {
    const numeric = ingredient.numericTotal === null ? '' : displayNumber(ingredient.numericTotal);
    const quantity = numeric
      ? `${numeric}${ingredient.unit ? ` ${ingredient.unit}` : ''}`
      : ingredient.fallbackQuantities.join(' + ') || '1';
    return {
      name: ingredient.name,
      normalizedName: ingredient.normalizedName,
      quantity,
      fromMeals: [...ingredient.fromMeals],
    };
  });
}

export function subtractInventory<T extends AggregatedIngredient>(
  ingredients: T[],
  inventoryNames: string[],
): T[] {
  return ingredients.filter((ingredient) =>
    !inventoryNames.some((inventoryName) => ingredientMatches(inventoryName, ingredient.normalizedName)),
  );
}
