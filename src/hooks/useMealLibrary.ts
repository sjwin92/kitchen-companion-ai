import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';

export interface MealLibraryEntry {
  id: string;
  user_id: string;
  external_recipe_id: string | null;
  title: string;
  description: string | null;
  image: string | null;
  instructions: string | null;
  ingredients: { name: string; quantity?: string; unit?: string }[];
  substitutions: { original: string; replacement: string; reason?: string }[];
  missing_ingredients: string[];
  nutrition: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
  dietary_tags: string[];
  category: string | null;
  cuisine: string | null;
  prep_time: string | null;
  source: 'generated' | 'adapted' | 'external' | 'manual';
  generation_context: Record<string, unknown>;
  use_soon_items_used: string[];
  times_viewed: number;
  times_planned: number;
  times_cooked: number;
  times_skipped: number;
  avg_rating: number | null;
  last_planned_at: string | null;
  last_cooked_at: string | null;
  is_promoted: boolean;
  lifecycle_status: 'private' | 'validated' | 'shared';
  quality_score: number;
  promotion_score: number;
  recommendation_reason: string | null;
  effort_level: string | null;
  original_user_id: string | null;
  content_status: string | null;
  content_score: number;
  youtube_ready: boolean;
  created_at: string;
  updated_at: string;
}

export type MealLibraryInsert = Partial<MealLibraryEntry> & { title: string };

/**
 * Meal Memory Layer — persistent store for generated/adapted meals
 * with behavioral counters, promotion logic, and ranking support.
 */
export function useMealLibrary() {
  const { session } = useApp();
  const [meals, setMeals] = useState<MealLibraryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const userId = session?.user?.id;

  // ─── Fetch ────────────────────────────────────────
  const fetchLibrary = useCallback(async (opts?: {
    promotedOnly?: boolean;
    source?: string;
    limit?: number;
    includeShared?: boolean;
    lifecycleStatus?: 'private' | 'validated' | 'shared';
  }) => {
    if (!userId) return [];
    setLoading(true);
    let q = supabase
      .from('meal_library')
      .select('*')
      .order('quality_score', { ascending: false })
      .order('times_cooked', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 200);

    if (opts?.includeShared) {
      // Fetch both own meals and shared meals
      q = q.or(`user_id.eq.${userId},lifecycle_status.eq.shared`);
    } else {
      q = q.eq('user_id', userId);
    }

    if (opts?.promotedOnly) q = q.eq('is_promoted', true);
    if (opts?.source) q = q.eq('source', opts.source);
    if (opts?.lifecycleStatus) q = q.eq('lifecycle_status', opts.lifecycleStatus);

    const { data } = await q;
    const entries = (data || []) as unknown as MealLibraryEntry[];
    setMeals(entries);
    setLoading(false);
    return entries;
  }, [userId]);

  // ─── Save / Upsert ───────────────────────────────
  const saveMeal = useCallback(async (meal: MealLibraryInsert): Promise<MealLibraryEntry | null> => {
    if (!userId) return null;

    // Check if this meal already exists (by external_recipe_id or title match)
    if (meal.external_recipe_id) {
      const { data: existing } = await supabase
        .from('meal_library')
        .select('id')
        .eq('user_id', userId)
        .eq('external_recipe_id', meal.external_recipe_id)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Update existing entry with any new metadata
        const { data } = await supabase
          .from('meal_library')
          .update({
            ...(meal.ingredients && { ingredients: meal.ingredients }),
            ...(meal.substitutions && { substitutions: meal.substitutions }),
            ...(meal.nutrition && { nutrition: meal.nutrition }),
            ...(meal.dietary_tags && { dietary_tags: meal.dietary_tags }),
            ...(meal.generation_context && { generation_context: meal.generation_context }),
            ...(meal.image && { image: meal.image }),
          } as any)
          .eq('id', existing.id)
          .select()
          .single();
        return (data as unknown as MealLibraryEntry) || null;
      }
    }

    const { data } = await supabase
      .from('meal_library')
      .insert({
        user_id: userId,
        title: meal.title,
        description: meal.description || null,
        image: meal.image || null,
        instructions: meal.instructions || null,
        external_recipe_id: meal.external_recipe_id || null,
        ingredients: meal.ingredients || [],
        substitutions: meal.substitutions || [],
        missing_ingredients: meal.missing_ingredients || [],
        nutrition: meal.nutrition || {},
        dietary_tags: meal.dietary_tags || [],
        category: meal.category || null,
        cuisine: meal.cuisine || null,
        prep_time: meal.prep_time || null,
        source: meal.source || 'generated',
        generation_context: meal.generation_context || {},
        use_soon_items_used: meal.use_soon_items_used || [],
      } as any)
      .select()
      .single();

    const entry = (data as unknown as MealLibraryEntry) || null;
    if (entry) setMeals(prev => [entry, ...prev]);
    return entry;
  }, [userId]);

  // ─── Batch save (for auto-plan results) ───────────
  const saveBatch = useCallback(async (mealList: MealLibraryInsert[]): Promise<MealLibraryEntry[]> => {
    if (!userId || mealList.length === 0) return [];

    const rows = mealList.map(m => ({
      user_id: userId,
      title: m.title,
      description: m.description || null,
      image: m.image || null,
      instructions: m.instructions || null,
      external_recipe_id: m.external_recipe_id || null,
      ingredients: m.ingredients || [],
      substitutions: m.substitutions || [],
      missing_ingredients: m.missing_ingredients || [],
      nutrition: m.nutrition || {},
      dietary_tags: m.dietary_tags || [],
      category: m.category || null,
      cuisine: m.cuisine || null,
      prep_time: m.prep_time || null,
      source: m.source || 'generated',
      generation_context: m.generation_context || {},
      use_soon_items_used: m.use_soon_items_used || [],
    }));

    const { data } = await supabase
      .from('meal_library')
      .insert(rows as any)
      .select();

    const entries = (data || []) as unknown as MealLibraryEntry[];
    if (entries.length) setMeals(prev => [...entries, ...prev]);
    return entries;
  }, [userId]);

  // ─── Signal tracking ──────────────────────────────
  const trackSignal = useCallback(async (
    libraryId: string,
    signal: 'viewed' | 'planned' | 'cooked' | 'skipped'
  ) => {
    if (!userId) return;

    const counterField = `times_${signal}` as const;
    const existing = meals.find(m => m.id === libraryId);
    const currentCount = existing ? (existing as any)[counterField] ?? 0 : 0;

    const updates: Record<string, any> = {
      [counterField]: currentCount + 1,
    };

    if (signal === 'planned') updates.last_planned_at = new Date().toISOString();
    if (signal === 'cooked') updates.last_cooked_at = new Date().toISOString();

    await supabase
      .from('meal_library')
      .update(updates as any)
      .eq('id', libraryId);

    setMeals(prev => prev.map(m =>
      m.id === libraryId
        ? { ...m, ...updates }
        : m
    ));
  }, [userId, meals]);

  // ─── Update rating ────────────────────────────────
  const updateRating = useCallback(async (libraryId: string, rating: number) => {
    if (!userId) return;

    const existing = meals.find(m => m.id === libraryId);
    const currentAvg = existing?.avg_rating ?? rating;
    const cooked = existing?.times_cooked ?? 1;
    // Running average weighted by cook count
    const newAvg = cooked > 1
      ? ((currentAvg * (cooked - 1)) + rating) / cooked
      : rating;

    await supabase
      .from('meal_library')
      .update({ avg_rating: Math.round(newAvg * 100) / 100 } as any)
      .eq('id', libraryId);

    setMeals(prev => prev.map(m =>
      m.id === libraryId ? { ...m, avg_rating: newAvg } : m
    ));
  }, [userId, meals]);

  // ─── Promotion logic ──────────────────────────────
  const promoteMeal = useCallback(async (libraryId: string) => {
    await supabase
      .from('meal_library')
      .update({ is_promoted: true } as any)
      .eq('id', libraryId);
    setMeals(prev => prev.map(m =>
      m.id === libraryId ? { ...m, is_promoted: true } : m
    ));
  }, []);

  const demoteMeal = useCallback(async (libraryId: string) => {
    await supabase
      .from('meal_library')
      .update({ is_promoted: false } as any)
      .eq('id', libraryId);
    setMeals(prev => prev.map(m =>
      m.id === libraryId ? { ...m, is_promoted: false } : m
    ));
  }, []);

  /** Promote a validated meal to the shared library */
  const promoteToShared = useCallback(async (libraryId: string) => {
    const meal = meals.find(m => m.id === libraryId);
    if (!meal) return;
    
    await supabase
      .from('meal_library')
      .update({
        lifecycle_status: 'shared',
        original_user_id: meal.user_id,
        // Clear user-specific context when sharing
        generation_context: {},
      } as any)
      .eq('id', libraryId);
    
    setMeals(prev => prev.map(m =>
      m.id === libraryId ? { ...m, lifecycle_status: 'shared' as const, original_user_id: meal.user_id } : m
    ));
  }, [meals]);

  /** Auto-promote meals that meet success criteria */
  const autoPromote = useCallback(async () => {
    if (!userId) return;
    // Criteria: cooked ≥2 times AND avg_rating ≥ 3.5 AND not yet promoted
    const candidates = meals.filter(m =>
      !m.is_promoted &&
      m.times_cooked >= 2 &&
      m.avg_rating !== null &&
      m.avg_rating >= 3.5
    );
    if (candidates.length === 0) return;

    const ids = candidates.map(c => c.id);
    for (const id of ids) {
      await supabase
        .from('meal_library')
        .update({ is_promoted: true } as any)
        .eq('id', id);
    }

    setMeals(prev => prev.map(m =>
      ids.includes(m.id) ? { ...m, is_promoted: true } : m
    ));

    return candidates.length;
  }, [userId, meals]);

  // ─── Find by recipe ID ────────────────────────────
  const findByRecipeId = useCallback((recipeId: string) => {
    return meals.find(m => m.external_recipe_id === recipeId);
  }, [meals]);

  // ─── Ranked suggestions ───────────────────────────
  /** Get top-ranked meals from the library for recommendations */
  const getRankedMeals = useCallback((opts?: {
    limit?: number;
    promotedOnly?: boolean;
    excludeIds?: string[];
  }): MealLibraryEntry[] => {
    let pool = [...meals];

    if (opts?.promotedOnly) pool = pool.filter(m => m.is_promoted);
    if (opts?.excludeIds?.length) {
      pool = pool.filter(m => !opts.excludeIds!.includes(m.id));
    }

    // Score: weighted combo of rating, cook frequency, recency
    const now = Date.now();
    const scored = pool.map(m => {
      const ratingScore = (m.avg_rating ?? 2.5) / 5; // 0-1
      const cookScore = Math.min(m.times_cooked / 10, 1); // 0-1
      const recency = m.last_cooked_at
        ? Math.max(0, 1 - (now - new Date(m.last_cooked_at).getTime()) / (30 * 86400000))
        : 0.3; // default for never-cooked
      const skipPenalty = m.times_skipped > 0
        ? Math.max(0, 1 - m.times_skipped / (m.times_planned || 1))
        : 1;

      const score = (ratingScore * 0.4) + (cookScore * 0.25) + (recency * 0.2) + (skipPenalty * 0.15);
      return { meal: m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, opts?.limit ?? 20).map(s => s.meal);
  }, [meals]);

  // ─── Delete ────────────────────────────────────────
  const removeMeal = useCallback(async (libraryId: string) => {
    await supabase.from('meal_library').delete().eq('id', libraryId);
    setMeals(prev => prev.filter(m => m.id !== libraryId));
  }, []);

  return {
    meals,
    loading,
    fetchLibrary,
    saveMeal,
    saveBatch,
    trackSignal,
    updateRating,
    promoteMeal,
    demoteMeal,
    autoPromote,
    findByRecipeId,
    getRankedMeals,
    removeMeal,
  };
}
