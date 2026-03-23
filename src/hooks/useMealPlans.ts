import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { format, startOfWeek, addDays } from 'date-fns';

export type MealPlan = {
  id: string;
  recipe_id: string;
  title: string;
  image: string | null;
  planned_date: string;
  meal_slot: string;
  created_at: string;
};

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealSlot = typeof MEAL_SLOTS[number];

export function useMealPlans(weekStart?: Date) {
  const { session } = useApp();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id;
  const start = weekStart ?? startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = addDays(start, 6);

  const fetchPlans = useCallback(async () => {
    if (!userId) { setPlans([]); setLoading(false); return; }
    const { data } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('user_id', userId)
      .gte('planned_date', format(start, 'yyyy-MM-dd'))
      .lte('planned_date', format(end, 'yyyy-MM-dd'))
      .order('planned_date');
    setPlans((data as MealPlan[]) || []);
    setLoading(false);
  }, [userId, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const addPlan = useCallback(
    async (recipeId: string, title: string, date: Date, slot: MealSlot, image?: string) => {
      if (!userId) return false;
      const planned_date = format(date, 'yyyy-MM-dd');
      const { error } = await supabase
        .from('meal_plans')
        .upsert(
          { user_id: userId, recipe_id: recipeId, title, image: image ?? null, planned_date, meal_slot: slot },
          { onConflict: 'user_id,planned_date,meal_slot' }
        );
      if (!error) { await fetchPlans(); return true; }
      return false;
    },
    [userId, fetchPlans]
  );

  const removePlan = useCallback(
    async (planId: string) => {
      await supabase.from('meal_plans').delete().eq('id', planId);
      setPlans(prev => prev.filter(p => p.id !== planId));
    },
    []
  );

  const getPlansForDate = useCallback(
    (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return plans.filter(p => p.planned_date === dateStr);
    },
    [plans]
  );

  return { plans, loading, addPlan, removePlan, getPlansForDate, refetch: fetchPlans };
}
