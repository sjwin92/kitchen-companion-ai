import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import type { MealSlot } from '@/hooks/useMealPlans';
import type { SlotSettings } from '@/hooks/useMealSlotSettings';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getDietaryKeywordsForSlot, passesUserDietaryFilters } from '@/lib/dietaryFilter';
import { useSmartRecommendations } from '@/hooks/useSmartRecommendations';
import { explainSuggestion, reasonChipClass } from '@/lib/recommendationReason';

interface Suggestion {
  id: string;
  name: string;
  thumb: string;
  ingredients: string[];
}

interface Props {
  slot: MealSlot;
  date: Date;
  slotSettings?: SlotSettings;
  onSelect: (recipeId: string, title: string, image?: string) => Promise<void>;
}

export default function GuidedSuggestions({ slot, date, slotSettings, onSelect }: Props) {
  const { preferences } = useApp();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Build keyword pool using diet-aware helper
      const keywords = getDietaryKeywordsForSlot(slot, preferences);
      if (slotSettings?.cuisine_preference) keywords.push(slotSettings.cuisine_preference);
      const keyword = keywords[Math.floor(Math.random() * keywords.length)] ?? 'vegetable';

      const url = `https://${projectId}.supabase.co/functions/v1/mealdb-proxy?path=${encodeURIComponent(`search.php?s=${keyword}`)}`;
      const res = await fetch(url, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const data = await res.json();

      const meals: Suggestion[] = (data.meals ?? []).map((m: any) => {
        const ingredients: string[] = [];
        for (let i = 1; i <= 20; i++) {
          const ing = m[`strIngredient${i}`];
          if (ing && ing.trim()) ingredients.push(ing.trim());
        }
        return { id: m.idMeal, name: m.strMeal, thumb: m.strMealThumb, ingredients };
      });

      const filtered = meals
        .filter(m => passesUserDietaryFilters(m.name, m.ingredients, preferences))
        .slice(0, 3);

      setSuggestions(filtered);
    } catch {
      toast.error('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  }, [slot, slotSettings?.cuisine_preference, preferences]);

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
      {slotSettings && (
        <p className="text-[10px] text-muted-foreground">
          {slotSettings.target_prep_time} · {slotSettings.complexity}
          {slotSettings.cuisine_preference ? ` · ${slotSettings.cuisine_preference}` : ''}
          {slotSettings.quick_bias ? ' · Quick' : ''}
          {slotSettings.family_friendly_bias ? ' · Family' : ''}
        </p>
      )}
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
