import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';

export type FavoriteRecipe = {
  id: string;
  recipe_id: string;
  title: string;
  image: string | null;
  category: string | null;
  created_at: string;
};

export function useFavorites() {
  const { session } = useApp();
  const [favorites, setFavorites] = useState<FavoriteRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id;

  const fetchFavorites = useCallback(async () => {
    if (!userId) { setFavorites([]); setLoading(false); return; }
    const { data } = await supabase
      .from('favorite_recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setFavorites((data as FavoriteRecipe[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const isFavorite = useCallback(
    (recipeId: string) => favorites.some(f => f.recipe_id === recipeId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (recipeId: string, title: string, image?: string, category?: string) => {
      if (!userId) return;
      const existing = favorites.find(f => f.recipe_id === recipeId);
      if (existing) {
        await supabase.from('favorite_recipes').delete().eq('id', existing.id);
        setFavorites(prev => prev.filter(f => f.id !== existing.id));
      } else {
        const { data } = await supabase
          .from('favorite_recipes')
          .insert({ user_id: userId, recipe_id: recipeId, title, image: image ?? null, category: category ?? null })
          .select()
          .single();
        if (data) setFavorites(prev => [data as FavoriteRecipe, ...prev]);
      }
    },
    [userId, favorites]
  );

  return { favorites, loading, isFavorite, toggleFavorite, refetch: fetchFavorites };
}
