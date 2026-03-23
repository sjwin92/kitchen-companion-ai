import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getRecipeById } from '@/services/recipes/recipeProvider';
import { useApp } from '@/context/AppContext';
import { useMealPlans } from '@/hooks/useMealPlans';
import type { MealSuggestion } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, ChefHat, Clock, CalendarPlus, Check } from 'lucide-react';
import { toast } from 'sonner';

interface PairingSuggestion {
  name: string;
  reason: string;
  search_term: string;
}

interface PairingWithRecipe extends PairingSuggestion {
  recipe?: MealSuggestion;
  loading?: boolean;
}

interface Props {
  recipeTitle: string;
  category?: string;
  area?: string;
  ingredients: string[];
}

export default function PairingSuggestions({ recipeTitle, category, area, ingredients }: Props) {
  const navigate = useNavigate();
  const { session } = useApp();
  const { addPlan } = useMealPlans();
  const [pairings, setPairings] = useState<PairingWithRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const handleAddToPlanner = async (pairing: PairingWithRecipe, idx: number) => {
    if (!session?.user || !pairing.recipe) return;
    const success = await addPlan(
      pairing.recipe.id,
      pairing.recipe.title,
      new Date(),
      'dinner',
      pairing.recipe.image
    );
    if (success) {
      setAddedIds(prev => new Set(prev).add(idx));
      toast.success(`Added ${pairing.recipe.title} to today's planner`);
    } else {
      toast.error('Failed to add to planner');
    }
  };

  const fetchPairings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-pairings', {
        body: { title: recipeTitle, category, area, ingredients },
      });
      if (error) throw error;

      const suggestions: PairingSuggestion[] = data.pairings || [];
      const withRecipes: PairingWithRecipe[] = suggestions.map(s => ({ ...s, loading: true }));
      setPairings(withRecipes);
      setLoaded(true);

      // Search TheMealDB for each suggestion in parallel
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      await Promise.all(
        suggestions.map(async (suggestion, idx) => {
          try {
            const url = `https://${projectId}.supabase.co/functions/v1/mealdb-proxy?path=${encodeURIComponent(`search.php?s=${suggestion.search_term}`)}`;
            const resp = await fetch(url, {
              headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
            });
            if (!resp.ok) return;
            const result = await resp.json();
            const meal = result.meals?.[0];
            if (meal) {
              const recipe = await getRecipeById(`mealdb-${meal.idMeal}`);
              setPairings(prev =>
                prev.map((p, i) => i === idx ? { ...p, recipe: recipe || undefined, loading: false } : p)
              );
            } else {
              setPairings(prev =>
                prev.map((p, i) => i === idx ? { ...p, loading: false } : p)
              );
            }
          } catch {
            setPairings(prev =>
              prev.map((p, i) => i === idx ? { ...p, loading: false } : p)
            );
          }
        })
      );
    } catch (err) {
      console.error('Pairing error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!loaded && !loading) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Pairs well with</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Get AI-powered side dish suggestions to complete this meal
        </p>
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={fetchPairings}>
          <Sparkles className="w-3.5 h-3.5" /> Get Pairing Suggestions
        </Button>
      </div>
    );
  }

  if (loading && pairings.length === 0) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Finding perfect pairings…</h2>
        </div>
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Pairs well with</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Complete your meal with these complementary dishes
        </p>
      </div>

      <div className="divide-y divide-border/40">
        {pairings.map((pairing, idx) => (
          <div key={idx} className="p-3">
            {pairing.loading ? (
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ) : pairing.recipe ? (
              <div className="flex items-start gap-3">
                {pairing.recipe.image ? (
                  <img
                    src={pairing.recipe.image}
                    alt={pairing.recipe.title}
                    className="w-16 h-16 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(`/recipe/${pairing.recipe!.id}`)}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <ChefHat className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-sm font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={() => navigate(`/recipe/${pairing.recipe!.id}`)}
                  >
                    {pairing.recipe.title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{pairing.reason}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> {pairing.recipe.prepTime}
                    </span>
                    {pairing.recipe.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {pairing.recipe.category}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 w-8 h-8"
                  onClick={() => navigate(`/recipe/${pairing.recipe!.id}`)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <ChefHat className="w-5 h-5 text-muted-foreground/30" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground">{pairing.name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{pairing.reason}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
