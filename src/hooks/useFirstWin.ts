import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';

export interface FirstWinProgress {
  inventoryAdded: boolean;
  mealPlanned: boolean;
  mealLogged: boolean;
  groceryGenerated: boolean;
  recipeViewed: boolean;
  completedCount: number;
  totalSteps: number;
  allComplete: boolean;
}

const STEPS = ['inventoryAdded', 'mealPlanned', 'mealLogged', 'groceryGenerated', 'recipeViewed'] as const;

export function useFirstWin() {
  const { session, inventory } = useApp();
  const [progress, setProgress] = useState<FirstWinProgress>({
    inventoryAdded: false,
    mealPlanned: false,
    mealLogged: false,
    groceryGenerated: false,
    recipeViewed: false,
    completedCount: 0,
    totalSteps: 5,
    allComplete: false,
  });
  const [loading, setLoading] = useState(true);
  const userId = session?.user?.id;

  const check = useCallback(async () => {
    if (!userId) { setLoading(false); return; }

    // Check inventory
    const inventoryAdded = inventory.length > 0;

    // Check meal plans
    const { count: planCount } = await supabase
      .from('meal_plans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    const mealPlanned = (planCount || 0) > 0;

    // Check meal log
    const { count: logCount } = await supabase
      .from('meal_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    const mealLogged = (logCount || 0) > 0;

    // Check interactions for recipe viewed and grocery
    const { data: interactions } = await supabase
      .from('user_interactions')
      .select('event_type')
      .eq('user_id', userId)
      .in('event_type', ['recipe_viewed'] as any)
      .limit(1);
    const recipeViewed = (interactions || []).length > 0;

    // Check shopping list
    const { count: shopCount } = await supabase
      .from('shopping_list')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    const groceryGenerated = (shopCount || 0) > 0;

    const results = { inventoryAdded, mealPlanned, mealLogged, groceryGenerated, recipeViewed };
    const completedCount = Object.values(results).filter(Boolean).length;

    setProgress({
      ...results,
      completedCount,
      totalSteps: 5,
      allComplete: completedCount >= 5,
    });
    setLoading(false);
  }, [userId, inventory.length]);

  useEffect(() => { check(); }, [check]);

  return { progress, loading, refresh: check };
}
