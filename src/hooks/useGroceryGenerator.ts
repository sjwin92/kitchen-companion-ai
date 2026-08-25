import { useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { ingredientMatches } from '@/lib/mealMatching';
import type { MealPlan } from './useMealPlans';
import { toast } from 'sonner';

type CatalogueIngredient = {
  recipe_id: string;
  name: string;
  normalized_name: string;
  quantity: number | null;
  unit: string | null;
  optional: boolean;
};

type GroceryRow = { name: string; quantity: string };
const db = supabase as unknown as SupabaseClient;

type ComparableAmount = { family: 'mass' | 'volume' | 'count'; value: number };

function comparableAmount(value: number, unit?: string | null): ComparableAmount | null {
  const normalizedUnit = unit?.trim().toLowerCase().replace(/\.$/, '') ?? '';
  if (!Number.isFinite(value) || value < 0) return null;
  if (['g', 'gram', 'grams'].includes(normalizedUnit)) return { family: 'mass', value };
  if (['kg', 'kilogram', 'kilograms'].includes(normalizedUnit)) return { family: 'mass', value: value * 1000 };
  if (['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'].includes(normalizedUnit)) return { family: 'volume', value };
  if (['l', 'litre', 'litres', 'liter', 'liters'].includes(normalizedUnit)) return { family: 'volume', value: value * 1000 };
  if (['', 'count', 'item', 'items', 'tin', 'tins', 'can', 'cans', 'pack', 'packs'].includes(normalizedUnit)) {
    return { family: 'count', value };
  }
  return null;
}

function parseAmount(value?: string | null): ComparableAmount | null {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)/);
  return match ? comparableAmount(Number(match[1]), match[2]) : null;
}

function inventoryCoversGrocery(grocery: GroceryRow, inventory: ReturnType<typeof useApp>['inventory']): boolean {
  const matchingItems = inventory.filter(item => ingredientMatches(item.name, grocery.name));
  if (matchingItems.length === 0) return false;

  const needed = parseAmount(grocery.quantity);
  if (!needed) return true;

  const available = matchingItems
    .map(item => item.quantityValue !== undefined
      ? comparableAmount(item.quantityValue, item.unit)
      : parseAmount(item.quantity))
    .filter((amount): amount is ComparableAmount => amount?.family === needed.family)
    .reduce((sum, amount) => sum + amount.value, 0);

  return available >= needed.value;
}

function aggregateIngredients(plans: MealPlan[], ingredients: CatalogueIngredient[]): GroceryRow[] {
  const recipeCounts = new Map<string, number>();
  for (const plan of plans) recipeCounts.set(plan.recipe_id, (recipeCounts.get(plan.recipe_id) ?? 0) + 1);

  const grouped = new Map<string, { name: string; quantity: number | null; unit: string | null; occurrences: number }>();
  for (const ingredient of ingredients) {
    if (ingredient.optional) continue;
    const count = recipeCounts.get(ingredient.recipe_id) ?? 1;
    const key = `${ingredient.normalized_name.toLowerCase()}::${ingredient.unit?.toLowerCase() ?? ''}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.occurrences += count;
      if (existing.quantity !== null && ingredient.quantity !== null) existing.quantity += Number(ingredient.quantity) * count;
      else existing.quantity = null;
    } else {
      grouped.set(key, {
        name: ingredient.name,
        quantity: ingredient.quantity === null ? null : Number(ingredient.quantity) * count,
        unit: ingredient.unit,
        occurrences: count,
      });
    }
  }

  return [...grouped.values()].map((ingredient) => ({
    name: ingredient.name,
    quantity: ingredient.quantity !== null
      ? `${Number(ingredient.quantity.toFixed(2))}${ingredient.unit ? ` ${ingredient.unit}` : ''}`
      : ingredient.occurrences > 1 ? `${ingredient.occurrences} portions` : '1',
  }));
}

export function useGroceryGenerator() {
  const { inventory, session } = useApp();
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(async (plans: MealPlan[]) => {
    if (!session?.user) {
      toast.error('Please sign in first');
      return;
    }
    if (plans.length === 0) {
      toast.info('No meals planned this week');
      return;
    }

    setGenerating(true);
    try {
      const recipeIds = [...new Set(plans.map(plan => plan.recipe_id))];
      const { data, error } = await db
        .from('recipe_ingredients')
        .select('recipe_id,name,normalized_name,quantity,unit,optional')
        .in('recipe_id', recipeIds);
      if (error) throw error;

      const groceries = aggregateIngredients(plans, (data ?? []) as CatalogueIngredient[]);
      if (groceries.length === 0) {
        toast.info('No reviewed catalogue ingredients were found for these meals');
        return;
      }

      const missing = groceries.filter(grocery => !inventoryCoversGrocery(grocery, inventory));
      if (missing.length === 0) {
        toast.success('You already have all the ingredients');
        return;
      }

      const { data: existing, error: existingError } = await supabase
        .from('shopping_list')
        .select('id,name,quantity')
        .eq('user_id', session.user.id)
        .eq('checked', false);
      if (existingError) throw existingError;

      const existingByName = new Map((existing ?? []).map(row => [row.name.trim().toLowerCase(), row]));
      const toAdd = missing.filter(grocery => !existingByName.has(grocery.name.trim().toLowerCase()));
      const toIncrease = missing.flatMap(grocery => {
        const row = existingByName.get(grocery.name.trim().toLowerCase());
        if (!row) return [];
        const current = parseAmount(row.quantity);
        const required = parseAmount(grocery.quantity);
        if (!required || (current?.family === required.family && current.value >= required.value)) return [];
        return [{ id: row.id, quantity: grocery.quantity }];
      });

      if (toAdd.length === 0 && toIncrease.length === 0) {
        toast.info('All missing ingredients are already on your shopping list');
        return;
      }

      if (toAdd.length > 0) {
        const { error: insertError } = await supabase.from('shopping_list').insert(
          toAdd.map(grocery => ({ user_id: session.user.id, ...grocery }))
        );
        if (insertError) throw insertError;
      }
      await Promise.all(toIncrease.map(async update => {
        const { error: updateError } = await supabase
          .from('shopping_list')
          .update({ quantity: update.quantity })
          .eq('id', update.id);
        if (updateError) throw updateError;
      }));

      const changed = toAdd.length + toIncrease.length;
      toast.success(`Updated ${changed} missing ingredient${changed === 1 ? '' : 's'} on your shopping list`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to build the shopping list');
    } finally {
      setGenerating(false);
    }
  }, [inventory, session]);

  return { generate, generating };
}
