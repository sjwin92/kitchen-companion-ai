import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';

export interface MealRating {
  id: string;
  recipe_id: string;
  title: string;
  rating: number;
  would_repeat: boolean;
  notes: string | null;
  meal_slot: string;
  meal_plan_id: string | null;
  created_at: string;
}

export function useMealRatings() {
  const { session } = useApp();
  const [ratings, setRatings] = useState<MealRating[]>([]);
  const [loading, setLoading] = useState(false);
  const userId = session?.user?.id;

  const fetchRatings = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('meal_ratings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    setRatings((data as MealRating[]) || []);
    setLoading(false);
  }, [userId]);

  const addRating = useCallback(async (
    recipeId: string,
    title: string,
    rating: number,
    wouldRepeat: boolean,
    slot: string,
    mealPlanId?: string,
    notes?: string,
  ) => {
    if (!userId) return false;
    const { error } = await supabase
      .from('meal_ratings')
      .insert({
        user_id: userId,
        recipe_id: recipeId,
        title,
        rating,
        would_repeat: wouldRepeat,
        meal_slot: slot,
        meal_plan_id: mealPlanId || null,
        notes: notes || null,
      } as any);
    if (!error) {
      await fetchRatings();
      return true;
    }
    return false;
  }, [userId, fetchRatings]);

  const getRatingForRecipe = useCallback((recipeId: string) => {
    return ratings.find(r => r.recipe_id === recipeId);
  }, [ratings]);

  return { ratings, loading, fetchRatings, addRating, getRatingForRecipe };
}
