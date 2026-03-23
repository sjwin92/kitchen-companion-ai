import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import type { MealPlan } from './useMealPlans';
import { toast } from 'sonner';

type MealDbMeal = { [key: string]: string | undefined | null };

async function fetchMealIngredients(recipeId: string): Promise<string[]> {
  // Extract the MealDB numeric id from our recipe_id format "mealdb-12345"
  const mealDbId = recipeId.replace('mealdb-', '');
  if (!mealDbId || isNaN(Number(mealDbId))) return [];

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = `https://${projectId}.supabase.co/functions/v1/mealdb-proxy?path=${encodeURIComponent(`lookup.php?i=${mealDbId}`)}`;

  const res = await fetch(url, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  const data = await res.json();
  const meal: MealDbMeal | undefined = data?.meals?.[0];
  if (!meal) return [];

  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (ing && ing.trim()) {
      const qty = measure?.trim() || '';
      ingredients.push(qty ? `${qty} ${ing.trim()}` : ing.trim());
    }
  }
  return ingredients;
}

export function useGroceryGenerator() {
  const { inventory, session } = useApp();
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(
    async (plans: MealPlan[]) => {
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
        // Fetch ingredients for all planned recipes in parallel
        const uniqueRecipeIds = [...new Set(plans.map(p => p.recipe_id))];
        const results = await Promise.all(uniqueRecipeIds.map(fetchMealIngredients));
        const allIngredients = results.flat();

        if (allIngredients.length === 0) {
          toast.info('No ingredients found for planned meals');
          setGenerating(false);
          return;
        }

        // Deduplicate ingredients (case-insensitive on ingredient name)
        const deduped = new Map<string, string>();
        for (const item of allIngredients) {
          const key = item.toLowerCase().trim();
          if (!deduped.has(key)) deduped.set(key, item);
        }

        // Filter out items already in inventory
        const inventoryNames = new Set(inventory.map(i => i.name.toLowerCase().trim()));
        const missing = [...deduped.values()].filter(item => {
          // Check if any inventory item name appears in this ingredient string
          const lower = item.toLowerCase();
          return ![...inventoryNames].some(inv => lower.includes(inv) || inv.includes(lower.split(' ').pop() || ''));
        });

        if (missing.length === 0) {
          toast.success('You already have all the ingredients!');
          setGenerating(false);
          return;
        }

        // Get existing shopping list to avoid duplicates
        const { data: existing } = await supabase
          .from('shopping_list')
          .select('name')
          .eq('user_id', session.user.id)
          .eq('checked', false);

        const existingNames = new Set((existing ?? []).map(e => e.name.toLowerCase()));
        const toAdd = missing.filter(m => !existingNames.has(m.toLowerCase()));

        if (toAdd.length === 0) {
          toast.info('All missing ingredients are already on your shopping list');
          setGenerating(false);
          return;
        }

        // Bulk insert
        const rows = toAdd.map(name => ({
          user_id: session.user.id,
          name,
          quantity: '1',
        }));

        const { error } = await supabase.from('shopping_list').insert(rows);
        if (error) throw error;

        toast.success(`Added ${toAdd.length} item${toAdd.length > 1 ? 's' : ''} to your shopping list`);
      } catch (err) {
        console.error(err);
        toast.error('Failed to generate grocery list');
      } finally {
        setGenerating(false);
      }
    },
    [inventory, session]
  );

  return { generate, generating };
}
