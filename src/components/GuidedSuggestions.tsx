import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import type { MealSlot } from '@/hooks/useMealPlans';
import type { SlotSettings } from '@/hooks/useMealSlotSettings';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useSmartRecommendations } from '@/hooks/useSmartRecommendations';
import { explainSuggestion, reasonChipClass } from '@/lib/recommendationReason';
import { listCatalogRecipes } from '@/services/betaCatalog';
import { recommendRecipes } from '@/lib/recommendationEngine';

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
  const { preferences, inventory, session } = useApp();
  const { signals, loadSignals } = useSmartRecommendations();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadSignals(); }, [loadSignals]);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const recipes = await listCatalogRecipes();
      const targetSlot = slot === 'lunchbox' ? 'lunch' : slot;
      const slotRecipes = recipes.filter((recipe) =>
        recipe.mealTypes.includes(slot) || recipe.mealTypes.includes(targetSlot),
      );
      const candidates = slotRecipes.length > 0 ? slotRecipes : recipes;
      const ranked = recommendRecipes({
        recipes: candidates,
        inventory,
        preferences,
        userSeed: session?.user.id ?? 'anonymous',
        weekKey: date.toISOString().slice(0, 10),
        limit: 3,
      });
      setSuggestions(ranked.map(({ recipe }) => ({
        id: recipe.id,
        name: recipe.title,
        thumb: recipe.imagePath ?? '',
        ingredients: recipe.ingredients.map((ingredient) => ingredient.name),
      })));
    } catch (error) {
      console.error('Failed to load guided catalogue suggestions', error);
      toast.error('Failed to load catalogue suggestions');
    } finally {
      setLoading(false);
    }
  }, [date, inventory, preferences, session?.user.id, slot]);

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
          <Sparkles className="w-3 h-3" /> From your recipe catalogue
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
        {suggestions.map(s => {
          const reason = explainSuggestion({
            recipeId: s.id,
            title: s.name,
            ingredients: s.ingredients,
            signals,
            inventory,
            preferredCuisines: preferences.preferredCuisines,
            cuisine: slotSettings?.cuisine_preference,
          });
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id, s.name, s.thumb)}
              className="w-full flex items-center gap-2.5 rounded-xl border border-border/50 p-2 hover:bg-accent/50 transition-colors text-left"
            >
              {s.thumb && (
                <img src={s.thumb} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{s.name}</p>
                {reason && (
                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${reasonChipClass(reason.kind)}`}>
                    {reason.text}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
