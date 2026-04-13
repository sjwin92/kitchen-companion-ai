import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

interface DerivedItem {
  name: string;
  quantity: string;
  estimatedPrice?: number;
  fromMeals: string[];
}

/**
 * Derives a shopping list from a weekly meal plan by:
 * 1. Aggregating all ingredients from planned meals (meal_library or MealDB)
 * 2. Subtracting owned inventory
 * 3. Estimating cost using ingredient_prices table
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
      // Fetch plans for current user
      let query = supabase
        .from('meal_plans')
        .select('id, recipe_id, title, meal_slot')
        .eq('user_id', session.user.id)
        .eq('status', 'planned');

      if (planIds?.length) {
        query = query.in('id', planIds);
      }

      const { data: plans } = await query;
      if (!plans || plans.length === 0) {
        setDerivedItems([]);
        setTotalEstimate(0);
        setDeriving(false);
        return [];
      }

      // Check meal_library for ingredient data
      const titles = plans.map(p => p.title);
      const { data: libraryMeals } = await supabase
        .from('meal_library')
        .select('title, ingredients')
        .eq('user_id', session.user.id)
        .in('title', titles);

      // Build ingredient map: ingredient -> { quantity, fromMeals }
      const ingredientMap = new Map<string, DerivedItem>();

      for (const libMeal of (libraryMeals || [])) {
        const ingredients = libMeal.ingredients as any[];
        if (!Array.isArray(ingredients)) continue;

        for (const ing of ingredients) {
          const name = (typeof ing === 'string' ? ing : ing?.name || '').toLowerCase().trim();
          if (!name) continue;
          const qty = typeof ing === 'object' ? ing?.quantity || '1' : '1';

          if (ingredientMap.has(name)) {
            const existing = ingredientMap.get(name)!;
            if (!existing.fromMeals.includes(libMeal.title)) {
              existing.fromMeals.push(libMeal.title);
            }
          } else {
            ingredientMap.set(name, { name, quantity: qty, fromMeals: [libMeal.title] });
          }
        }
      }

      // For MealDB recipes not in library, fetch from proxy
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const mealDbPlans = plans.filter(p => 
        p.recipe_id.startsWith('mealdb-') && 
        !(libraryMeals || []).some(lm => lm.title === p.title)
      );

      for (const plan of mealDbPlans) {
        const mealDbId = plan.recipe_id.replace('mealdb-', '');
        try {
          const url = `https://${projectId}.supabase.co/functions/v1/mealdb-proxy?path=${encodeURIComponent(`lookup.php?i=${mealDbId}`)}`;
          const res = await fetch(url, {
            headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          });
          const data = await res.json();
          const meal = data?.meals?.[0];
          if (!meal) continue;

          for (let i = 1; i <= 20; i++) {
            const ingName = meal[`strIngredient${i}`]?.trim();
            if (!ingName) continue;
            const measure = meal[`strMeasure${i}`]?.trim() || '1';
            const key = ingName.toLowerCase();

            if (ingredientMap.has(key)) {
              const existing = ingredientMap.get(key)!;
              if (!existing.fromMeals.includes(plan.title)) {
                existing.fromMeals.push(plan.title);
              }
            } else {
              ingredientMap.set(key, { name: ingName, quantity: measure, fromMeals: [plan.title] });
            }
          }
        } catch { /* skip */ }
      }

      // Subtract inventory
      const inventoryNames = new Set(inventory.map(i => i.name.toLowerCase().trim()));
      const missing: DerivedItem[] = [];
      for (const [key, item] of ingredientMap) {
        if (![...inventoryNames].some(inv => key.includes(inv) || inv.includes(key))) {
          missing.push(item);
        }
      }

      // Fetch price estimates
      if (missing.length > 0) {
        const { data: prices } = await supabase
          .from('ingredient_prices')
          .select('ingredient_name, estimated_price_gbp')
          .in('ingredient_name', missing.map(m => m.name.toLowerCase()));

        const priceMap = new Map((prices || []).map((p: any) => [p.ingredient_name, p.estimated_price_gbp]));

        for (const item of missing) {
          item.estimatedPrice = priceMap.get(item.name.toLowerCase()) as number | undefined;
        }

        setTotalEstimate(missing.reduce((sum, m) => sum + (m.estimatedPrice || 0), 0));
      }

      setDerivedItems(missing);
      setDeriving(false);
      return missing;
    } catch (err) {
      console.error('Shopping derivation failed:', err);
      setDeriving(false);
      return [];
    }
  }, [session, inventory]);

  const addDerivedToShoppingList = useCallback(async () => {
    if (!session?.user || derivedItems.length === 0) return;

    const { data: existing } = await supabase
      .from('shopping_list')
      .select('name')
      .eq('user_id', session.user.id)
      .eq('checked', false);

    const existingNames = new Set((existing || []).map(e => e.name.toLowerCase()));
    const toAdd = derivedItems.filter(d => !existingNames.has(d.name.toLowerCase()));

    if (toAdd.length === 0) {
      toast.info('All items already on your shopping list');
      return;
    }

    const rows = toAdd.map(d => ({
      user_id: session.user.id,
      name: d.name,
      quantity: d.quantity,
    }));

    const { error } = await supabase.from('shopping_list').insert(rows);
    if (!error) {
      toast.success(`Added ${toAdd.length} items to shopping list`);
    }
  }, [session, derivedItems]);

  return {
    derivedItems,
    totalEstimate,
    deriving,
    deriveFromPlans,
    addDerivedToShoppingList,
  };
}
