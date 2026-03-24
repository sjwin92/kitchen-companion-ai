import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';

export interface StapleMeal {
  id: string;
  recipe_id: string;
  title: string;
  image: string | null;
  category: string | null;
  meal_slot: string;
  frequency_hint: string;
  notes: string | null;
  created_at: string;
}

export function useStapleMeals() {
  const { session } = useApp();
  const [staples, setStaples] = useState<StapleMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = session?.user?.id;

  const fetchStaples = useCallback(async () => {
    if (!userId) { setStaples([]); setLoading(false); return; }
    const { data } = await supabase
      .from('staple_meals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setStaples((data as StapleMeal[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchStaples(); }, [fetchStaples]);

  const isStaple = useCallback(
    (recipeId: string) => staples.some(s => s.recipe_id === recipeId),
    [staples]
  );

  const toggleStaple = useCallback(async (
    recipeId: string,
    title: string,
    image?: string,
    category?: string,
    slot?: string,
  ) => {
    if (!userId) return;
    const existing = staples.find(s => s.recipe_id === recipeId);
    if (existing) {
      await supabase.from('staple_meals').delete().eq('id', existing.id);
      setStaples(prev => prev.filter(s => s.id !== existing.id));
    } else {
      const { data } = await supabase
        .from('staple_meals')
        .insert({
          user_id: userId,
          recipe_id: recipeId,
          title,
          image: image ?? null,
          category: category ?? null,
          meal_slot: slot ?? 'dinner',
        } as any)
        .select()
        .single();
      if (data) setStaples(prev => [data as StapleMeal, ...prev]);
    }
  }, [userId, staples]);

  return { staples, loading, isStaple, toggleStaple, refetch: fetchStaples };
}
