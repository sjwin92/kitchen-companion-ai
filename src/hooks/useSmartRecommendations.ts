import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';

interface RecommendationSignals {
  likedRecipeIds: string[];
  dislikedRecipeIds: string[];
  hiddenRecipeIds: string[];
  stapleRecipeIds: string[];
  topRatedRecipeIds: string[];
  avoidedIngredients: string[];
  frequentlyLoggedTitles: string[];
  mealSlotPreferences: Record<string, string[]>;
  /** Promoted meals from the library ranked by success score */
  libraryPromotedTitles: string[];
  /** Recipe IDs that exist in the meal library */
  libraryRecipeIds: string[];
}

export function useSmartRecommendations() {
  const { session, preferences } = useApp();
  const [signals, setSignals] = useState<RecommendationSignals | null>(null);
  const [loading, setLoading] = useState(false);
  const userId = session?.user?.id;

  const loadSignals = useCallback(async (): Promise<RecommendationSignals | null> => {
    if (!userId) return null;
    setLoading(true);

    try {
      // Fetch interactions
      const { data: interactions } = await supabase
        .from('user_interactions')
        .select('event_type, recipe_id, recipe_title, metadata')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500);

      const ints = interactions || [];

      const likedRecipeIds = [...new Set(ints.filter(i => i.event_type === 'recipe_liked').map(i => i.recipe_id).filter(Boolean))] as string[];
      const dislikedRecipeIds = [...new Set(ints.filter(i => i.event_type === 'recipe_disliked').map(i => i.recipe_id).filter(Boolean))] as string[];
      const hiddenRecipeIds = [...new Set(ints.filter(i => i.event_type === 'recipe_hidden').map(i => i.recipe_id).filter(Boolean))] as string[];
      const avoidedIngredients = [...new Set(
        ints.filter(i => i.event_type === 'ingredient_avoided').map(i => (i.metadata as any)?.ingredient).filter(Boolean)
      )] as string[];

      // Fetch staples
      const { data: staples } = await supabase
        .from('staple_meals')
        .select('recipe_id')
        .eq('user_id', userId);
      const stapleRecipeIds = (staples || []).map((s: any) => s.recipe_id);

      // Fetch top-rated
      const { data: ratings } = await supabase
        .from('meal_ratings')
        .select('recipe_id, rating')
        .eq('user_id', userId)
        .gte('rating', 4)
        .order('rating', { ascending: false })
        .limit(20);
      const topRatedRecipeIds = [...new Set((ratings || []).map((r: any) => r.recipe_id))];

      // Fetch frequently logged
      const { data: logs } = await supabase
        .from('meal_log')
        .select('title')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(100);
      const titleCounts: Record<string, number> = {};
      (logs || []).forEach((l: any) => {
        const t = l.title?.toLowerCase();
        if (t) titleCounts[t] = (titleCounts[t] || 0) + 1;
      });
      const frequentlyLoggedTitles = Object.entries(titleCounts)
        .filter(([, c]) => c >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([t]) => t)
        .slice(0, 10);

      // Slot preferences from meal plans
      const { data: plans } = await supabase
        .from('meal_plans')
        .select('meal_slot, title')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      const mealSlotPreferences: Record<string, string[]> = {};
      (plans || []).forEach((p: any) => {
        if (!mealSlotPreferences[p.meal_slot]) mealSlotPreferences[p.meal_slot] = [];
        if (!mealSlotPreferences[p.meal_slot].includes(p.title)) {
          mealSlotPreferences[p.meal_slot].push(p.title);
        }
      });

      const result: RecommendationSignals = {
        likedRecipeIds,
        dislikedRecipeIds,
        hiddenRecipeIds,
        stapleRecipeIds,
        topRatedRecipeIds,
        avoidedIngredients,
        frequentlyLoggedTitles,
        mealSlotPreferences,
      };

      setSignals(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /** Check if a recipe should be excluded from suggestions */
  const shouldExclude = useCallback((recipeId: string): boolean => {
    if (!signals) return false;
    return signals.dislikedRecipeIds.includes(recipeId) || signals.hiddenRecipeIds.includes(recipeId);
  }, [signals]);

  /** Check if a recipe is highly recommended */
  const isRecommended = useCallback((recipeId: string): boolean => {
    if (!signals) return false;
    return signals.likedRecipeIds.includes(recipeId) ||
           signals.topRatedRecipeIds.includes(recipeId) ||
           signals.stapleRecipeIds.includes(recipeId);
  }, [signals]);

  /** Get all ingredients to avoid (profile + interaction-based) */
  const getAllAvoidedIngredients = useCallback((): string[] => {
    const profile = [
      ...preferences.dislikedIngredients,
      ...preferences.allergies,
    ];
    const interaction = signals?.avoidedIngredients || [];
    return [...new Set([...profile, ...interaction])];
  }, [preferences.dislikedIngredients, preferences.allergies, signals]);

  return {
    signals,
    loading,
    loadSignals,
    shouldExclude,
    isRecommended,
    getAllAvoidedIngredients,
  };
}
