import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';

export type InteractionEvent =
  | 'recipe_viewed'
  | 'recipe_liked'
  | 'recipe_disliked'
  | 'recipe_hidden'
  | 'ingredient_avoided'
  | 'meal_added_to_plan'
  | 'meal_removed_from_plan'
  | 'meal_marked_cooked'
  | 'meal_marked_eaten'
  | 'meal_skipped'
  | 'meal_saved_as_staple'
  | 'meal_logged'
  | 'meal_favorited'
  | 'meal_repeated'
  | 'meal_swapped';

export function useInteractions() {
  const { session } = useApp();
  const userId = session?.user?.id;

  const track = useCallback(async (
    eventType: InteractionEvent,
    opts?: {
      recipeId?: string;
      recipeTitle?: string;
      mealPlanId?: string;
      metadata?: Record<string, unknown>;
    }
  ) => {
    if (!userId) return;
    await supabase.from('user_interactions').insert({
      user_id: userId,
      event_type: eventType,
      recipe_id: opts?.recipeId || null,
      recipe_title: opts?.recipeTitle || null,
      meal_plan_id: opts?.mealPlanId || null,
      metadata: opts?.metadata || {},
    } as any);
  }, [userId]);

  const getDislikedRecipeIds = useCallback(async (): Promise<string[]> => {
    if (!userId) return [];
    const { data } = await supabase
      .from('user_interactions')
      .select('recipe_id')
      .eq('user_id', userId)
      .in('event_type', ['recipe_disliked', 'recipe_hidden'] as any);
    return (data || []).map((d: any) => d.recipe_id).filter(Boolean);
  }, [userId]);

  const getAvoidedIngredients = useCallback(async (): Promise<string[]> => {
    if (!userId) return [];
    const { data } = await supabase
      .from('user_interactions')
      .select('metadata')
      .eq('user_id', userId)
      .eq('event_type', 'ingredient_avoided');
    return (data || []).map((d: any) => d.metadata?.ingredient).filter(Boolean);
  }, [userId]);

  return { track, getDislikedRecipeIds, getAvoidedIngredients };
}
