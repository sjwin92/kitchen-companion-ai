import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { format, startOfWeek, addDays } from 'date-fns';
import { appError } from '@/lib/appError';
import { getRecipeMediaUrl } from '@/services/betaCatalog';

export type MealPlanKind = 'catalogue' | 'user_recipe' | 'custom' | 'inventory';

export type MealPlan = {
  id: string;
  recipe_id: string;
  title: string;
  image: string | null;
  planned_date: string;
  meal_slot: string;
  status: string;
  created_at: string;
  planKind: MealPlanKind;
  inventoryItemId: string | null;
};

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack', 'lunchbox'] as const;
export type MealSlot = typeof MEAL_SLOTS[number];

type PlanOptions = { planKind?: MealPlanKind; inventoryItemId?: string | null };

function inferPlanKind(recipeId: string): MealPlanKind {
  return recipeId.startsWith('custom-') ? 'custom' : 'catalogue';
}

function mapPlan(row: Record<string, unknown>): MealPlan {
  const storedImage = row.image as string | null | undefined;

  return {
    ...(row as unknown as Omit<MealPlan, 'planKind' | 'inventoryItemId'>),
    image: getRecipeMediaUrl(storedImage ?? null),
    planKind: (row.plan_kind as MealPlanKind | undefined) ?? inferPlanKind(String(row.recipe_id)),
    inventoryItemId: (row.inventory_item_id as string | null | undefined) ?? null,
  };
}

export function useMealPlans(weekStart?: Date) {
  const { session } = useApp();
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user?.id;
  const start = weekStart ?? startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = addDays(start, 6);
  const startDate = format(start, 'yyyy-MM-dd');
  const endDate = format(end, 'yyyy-MM-dd');

  const fetchPlans = useCallback(async () => {
    if (!userId) { setPlans([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('user_id', userId)
      .gte('planned_date', startDate)
      .lte('planned_date', endDate)
      .order('planned_date');
    if (error) {
      const failure = appError(error, 'We could not load your meal plan. Please try again.');
      setError(failure.userMessage);
      setLoading(false);
      throw failure;
    }
    setPlans((data ?? []).map(row => mapPlan(row as unknown as Record<string, unknown>)));
    setLoading(false);
  }, [userId, startDate, endDate]);

  useEffect(() => { void fetchPlans().catch(() => undefined); }, [fetchPlans]);

  const addPlan = useCallback(
    async (recipeId: string, title: string, date: Date, slot: MealSlot, image?: string, options: PlanOptions = {}) => {
      if (!userId) throw appError(null, 'Please sign in before planning a meal.', { code: 'AUTH_REQUIRED', retryable: false });
      const planned_date = format(date, 'yyyy-MM-dd');
      const { error } = await supabase
        .from('meal_plans')
        .upsert(
          {
            user_id: userId,
            recipe_id: recipeId,
            title,
            image: image ?? null,
            planned_date,
            meal_slot: slot,
            plan_kind: options.planKind ?? inferPlanKind(recipeId),
            inventory_item_id: options.inventoryItemId ?? null,
          },
          { onConflict: 'user_id,planned_date,meal_slot' }
        );
      if (error) throw appError(error, 'This meal was not added to your plan. Please try again.');
      await fetchPlans();
      return true;
    },
    [userId, fetchPlans]
  );

  const removePlan = useCallback(
    async (planId: string) => {
      if (!userId) throw appError(null, 'Please sign in before removing a meal.', { code: 'AUTH_REQUIRED', retryable: false });
      const { data, error } = await supabase.from('meal_plans').delete().eq('id', planId).eq('user_id', userId).select('id').maybeSingle();
      if (error || !data) throw appError(error, 'This meal was not removed. Please try again.');
      setPlans(prev => prev.filter(p => p.id !== planId));
    },
    [userId]
  );

  const movePlan = useCallback(
    async (planId: string, newDate: Date, newSlot: MealSlot) => {
      if (!userId) throw appError(null, 'Please sign in before moving a meal.', { code: 'AUTH_REQUIRED', retryable: false });
      const planned_date = format(newDate, 'yyyy-MM-dd');
      const { error } = await supabase.rpc('move_meal_plan' as never, {
        p_plan_id: planId,
        p_target_date: planned_date,
        p_target_slot: newSlot,
      } as never);
      if (error) throw appError(error, 'This meal could not be moved. Your plan was not changed.');
      await fetchPlans();
      return true;
    },
    [userId, fetchPlans]
  );

  const getPlansForDate = useCallback(
    (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return plans.filter(p => p.planned_date === dateStr);
    },
    [plans]
  );

  const updatePlanImage = useCallback(
    async (planId: string, image: string) => {
      if (!userId) throw appError(null, 'Please sign in before editing a meal.', { code: 'AUTH_REQUIRED', retryable: false });
      const { data, error } = await supabase.from('meal_plans').update({ image }).eq('id', planId).eq('user_id', userId).select('id').maybeSingle();
      if (error || !data) throw appError(error, 'The meal image was not saved. Please try again.');
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, image } : p));
    },
    [userId]
  );

  const batchAddPlans = useCallback(
    async (meals: Array<{ recipeId: string; title: string; date: Date; slot: MealSlot; image?: string; planKind?: MealPlanKind; inventoryItemId?: string | null }>) => {
      if (!userId) throw appError(null, 'Please sign in before saving a plan.', { code: 'AUTH_REQUIRED', retryable: false });
      if (meals.length === 0) return true;
      const rows = meals.map(m => ({
        user_id: userId,
        recipe_id: m.recipeId,
        title: m.title,
        image: m.image ?? null,
        planned_date: format(m.date, 'yyyy-MM-dd'),
        meal_slot: m.slot,
        status: 'planned',
        plan_kind: m.planKind ?? inferPlanKind(m.recipeId),
        inventory_item_id: m.inventoryItemId ?? null,
      }));
      const { error } = await supabase
        .from('meal_plans')
        .upsert(rows, { onConflict: 'user_id,planned_date,meal_slot' });
      if (error) throw appError(error, 'Your meal plan was not saved. Please try again.');
      await fetchPlans();
      return true;
    },
    [userId, fetchPlans]
  );

  return { plans, loading, error, addPlan, batchAddPlans, updatePlanImage, removePlan, movePlan, getPlansForDate, refetch: fetchPlans };
}
