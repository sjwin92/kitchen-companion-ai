import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import type { MealSlot } from '@/hooks/useMealPlans';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Suggestion {
  id: string;
  name: string;
  thumb: string;
}

interface Props {
  slot: MealSlot;
  date: Date;
  onSelect: (recipeId: string, title: string, image?: string) => Promise<void>;
}

const SLOT_KEYWORDS: Record<MealSlot, string[]> = {
  breakfast: ['pancake', 'egg', 'porridge', 'omelette', 'toast'],
  lunch: ['salad', 'soup', 'sandwich', 'wrap', 'rice'],
  dinner: ['chicken', 'beef', 'pasta', 'curry', 'steak'],
  snack: ['cookie', 'fruit', 'yogurt', 'smoothie', 'cake'],
};

export default function GuidedSuggestions({ slot, date, onSelect }: Props) {
  const { preferences } = useApp();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Pick a keyword based on slot + cuisine preferences
      const keywords = SLOT_KEYWORDS[slot];
      const cuisineKeywords = preferences.preferredCuisines.length > 0
        ? preferences.preferredCuisines
        : [];
      const allKeywords = [...keywords, ...cuisineKeywords];
      const keyword = allKeywords[Math.floor(Math.random() * allKeywords.length)];

      const url = `https://${projectId}.supabase.co/functions/v1/mealdb-proxy?path=${encodeURIComponent(`search.php?s=${keyword}`)}`;
      const res = await fetch(url, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const data = await res.json();
      const meals = (data.meals ?? [])
        .map((m: any) => ({ id: m.idMeal, name: m.strMeal, thumb: m.strMealThumb }))
        .filter((m: Suggestion) => {
          // Filter out disliked ingredients from title
          const lower = m.name.toLowerCase();
          return !preferences.dislikedIngredients.some(d => lower.includes(d.toLowerCase()));
        })
        .slice(0, 3);

      setSuggestions(meals);
    } catch {
      toast.error('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  }, [slot, preferences.preferredCuisines, preferences.dislikedIngredients]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground text-xs gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Finding suggestions...
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Suggestions for you
        </p>
        <button onClick={fetchSuggestions} className="text-[10px] text-primary hover:underline flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>
      <div className="space-y-1.5">
        {suggestions.map(s => (
          <button
            key={s.id}
            onClick={() => onSelect(`mealdb-${s.id}`, s.name, s.thumb)}
            className="w-full flex items-center gap-2.5 rounded-xl border border-border/50 p-2 hover:bg-accent/50 transition-colors text-left"
          >
            {s.thumb && (
              <img src={s.thumb} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
            )}
            <p className="text-xs font-medium truncate flex-1">{s.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
