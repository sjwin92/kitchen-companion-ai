import { useCallback, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import {
  aggregateIngredients,
  subtractInventory,
  type AggregatedIngredient,
  type RequiredIngredient,
} from '@/lib/shoppingDerivation';
import { toast } from 'sonner';

interface DerivedItem extends AggregatedIngredient {
  estimatedPrice?: number;
}

type PlannedMeal = { id: string; recipe_id: string; title: string; meal_slot: string };
const db = supabase as unknown as SupabaseClient;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parsePrivateIngredients(recipe: { title: string; ingredients: unknown }): RequiredIngredient[] {
  if (!Array.isArray(recipe.ingredients)) return [];
  return recipe.ingredients.flatMap((ingredient) => {
    if (typeof ingredient === 'string') {
      const name = ingredient.trim();
      return name ? [{ name, quantity: 1, mealTitle: recipe.title }] : [];
    }
    if (!ingredient || typeof ingredient !== 'object') return [];
    const row = ingredient as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) return [];
    return [{
      name,
      normalizedName: typeof row.normalized_name === 'string' ? row.normalized_name : null,
      quantity: typeof row.quantity === 'number' || typeof row.quantity === 'string' ? row.quantity : 1,
      unit: typeof row.unit === 'string' ? row.unit : null,
      optional: Boolean(row.optional),
      mealTitle: recipe.title,
    }];
  });
}

/**
 * Builds one missing-ingredient list from the canonical recipe catalogue first,
 * then private AI/user recipes, with legacy/MealDB fallbacks for old plans.
 */
export function useShoppingDerivation() {
  const { inventory, session } = useApp();
  const [derivedItems, setDerivedItems] = useState<DerivedItem[]>([]);
  const [totalEstimate, setTotalEstimate] = useState(0);
  const [deriving, setDeriving] = useState(false);

  const deriveFromPlans = useCallback(async (planIds?: string[]) => {
    if (!session?.user) return [];
    setDeriving(true);

    try {
      let query = db
        .from('meal_plans')
        .select('id,recipe_id,title,meal_slot')
        .eq('user_id', session.user.id)
        .eq('status', 'planned');
      if (planIds?.length) query = query.in('id', planIds);

      const { data: planRows, error: planError } = await query;
      if (planError) throw planError;
      const plans = (planRows ?? []) as PlannedMeal[];
      if (plans.length === 0) {
        setDerivedItems([]);
        setTotalEstimate(0);
        return [];
      }

      const requirements: RequiredIngredient[] = [];
      const resolvedPlanIds = new Set<string>();
      const uuidPlans = plans.filter((plan) => UUID_PATTERN.test(plan.recipe_id));
      const uuidIds = [...new Set(uuidPlans.map((plan) => plan.recipe_id))];

      if (uuidIds.length > 0) {
        const { data: catalogueRows, error: catalogueError } = await db
          .from('recipe_ingredients')
          .select('recipe_id,name,normalized_name,quantity,unit,optional')
          .in('recipe_id', uuidIds)
          .order('position');
        if (catalogueError) throw catalogueError;

        for (const row of catalogueRows ?? []) {
          const matchingPlans = uuidPlans.filter((plan) => plan.recipe_id === row.recipe_id);
          for (const plan of matchingPlans) {
            resolvedPlanIds.add(plan.id);
            requirements.push({
              name: row.name,
              normalizedName: row.normalized_name,
              quantity: row.quantity === null ? null : Number(row.quantity),
              unit: row.unit,
              optional: Boolean(row.optional),
              mealTitle: plan.title,
            });
          }
        }

        const unresolvedUuidIds = [...new Set(uuidPlans
          .filter((plan) => !resolvedPlanIds.has(plan.id))
          .map((plan) => plan.recipe_id))];
        if (unresolvedUuidIds.length > 0) {
          const { data: privateRecipes, error: privateError } = await db
            .from('user_recipes')
            .select('id,title,ingredients')
            .eq('user_id', session.user.id)
            .in('id', unresolvedUuidIds);
          if (privateError) throw privateError;
          for (const privateRecipe of privateRecipes ?? []) {
            const matchingPlans = uuidPlans.filter((plan) => plan.recipe_id === privateRecipe.id);
            for (const plan of matchingPlans) {
              resolvedPlanIds.add(plan.id);
              requirements.push(...parsePrivateIngredients({ title: plan.title, ingredients: privateRecipe.ingredients }));
            }
          }
        }
      }

      const unresolvedPlans = plans.filter((plan) => !resolvedPlanIds.has(plan.id));
      if (unresolvedPlans.length > 0) {
        const titles = [...new Set(unresolvedPlans.map((plan) => plan.title))];
        const { data: legacyMeals, error: legacyError } = await db
          .from('meal_library')
          .select('title,ingredients')
          .eq('user_id', session.user.id)
          .in('title', titles);
        if (legacyError) throw legacyError;
        for (const legacyMeal of legacyMeals ?? []) {
          requirements.push(...parsePrivateIngredients(legacyMeal as { title: string; ingredients: unknown }));
          unresolvedPlans
            .filter((plan) => plan.title === legacyMeal.title)
            .forEach((plan) => resolvedPlanIds.add(plan.id));
        }
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const mealDbPlans = plans.filter((plan) =>
        !resolvedPlanIds.has(plan.id) && plan.recipe_id.startsWith('mealdb-'),
      );

      for (const plan of mealDbPlans) {
        try {
          const mealDbId = plan.recipe_id.replace('mealdb-', '');
          const path = encodeURIComponent(`lookup.php?i=${mealDbId}`);
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/mealdb-proxy?path=${path}`, {
            headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          });
          if (!response.ok) continue;
          const payload = await response.json();
          const meal = payload?.meals?.[0];
          if (!meal) continue;
          for (let index = 1; index <= 20; index += 1) {
            const name = meal[`strIngredient${index}`]?.trim();
            if (!name) continue;
            requirements.push({
              name,
              quantity: meal[`strMeasure${index}`]?.trim() || 1,
              mealTitle: plan.title,
            });
          }
        } catch {
          // Keep successfully resolved recipes when a legacy provider is unavailable.
        }
      }

      const missing = subtractInventory(
        aggregateIngredients(requirements),
        inventory.map((item) => item.name),
      ) as DerivedItem[];

      if (missing.length > 0) {
        const { data: prices } = await db
          .from('ingredient_prices')
          .select('ingredient_name,estimated_price_gbp')
          .in('ingredient_name', missing.map((item) => item.normalizedName));
        const priceMap = new Map((prices ?? []).map((price) => [
          String(price.ingredient_name).toLowerCase(),
          Number(price.estimated_price_gbp),
        ]));
        for (const item of missing) item.estimatedPrice = priceMap.get(item.normalizedName);
      }

      setDerivedItems(missing);
      setTotalEstimate(missing.reduce((total, item) => total + (item.estimatedPrice || 0), 0));
      return missing;
    } catch (error) {
      console.error('Shopping derivation failed', error);
      setDerivedItems([]);
      setTotalEstimate(0);
      toast.error('Could not build the shopping list from this plan. Please try again.');
      return [];
    } finally {
      setDeriving(false);
    }
  }, [session?.user, inventory]);

  const addDerivedToShoppingList = useCallback(async () => {
    if (!session?.user || derivedItems.length === 0) return;
    const { data: existing } = await db
      .from('shopping_list')
      .select('name')
      .eq('user_id', session.user.id)
      .eq('checked', false);
    const existingNames = new Set((existing ?? []).map((item) => String(item.name).toLowerCase()));
    const toAdd = derivedItems.filter((item) => !existingNames.has(item.name.toLowerCase()));
    if (toAdd.length === 0) {
      toast.info('All items are already on your shopping list');
      return;
    }

    const { error } = await db.from('shopping_list').insert(toAdd.map((item) => ({
      user_id: session.user.id,
      name: item.name,
      quantity: item.quantity,
    })));
    if (error) {
      toast.error('Could not update your shopping list');
      return;
    }
    toast.success(`Added ${toAdd.length} item${toAdd.length === 1 ? '' : 's'} to your shopping list`);
  }, [session?.user, derivedItems]);

  return { derivedItems, totalEstimate, deriving, deriveFromPlans, addDerivedToShoppingList };
}
