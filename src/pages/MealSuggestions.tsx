import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import {
  getRecipeSuggestions,
  getConfiguredRecipeSource,
  getRequestedRecipeSource,
  hasValidRecipeSourceConfig,
} from '@/services/recipes/recipeProvider';
import { getMealieConfigSummary, hasMealieConfig } from '@/services/recipes/mealieProvider';
import type { MealWithStatus } from '@/lib/mealMatching';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Check, ShoppingCart, Search, Plus, ChevronDown, ChevronUp, ArrowRight, Heart, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useFavorites } from '@/hooks/useFavorites';

const MAX_VISIBLE_MEALS = 30;

export default function MealSuggestions() {
  const { inventory, session } = useApp();
  const navigate = useNavigate();
  const [mealsWithStatus, setMealsWithStatus] = useState<MealWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [minMatchPercent, setMinMatchPercent] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { isFavorite, toggleFavorite } = useFavorites();

  const requestedSource = getRequestedRecipeSource();
  const configuredSource = getConfiguredRecipeSource();
  const hasValidSourceConfig = hasValidRecipeSourceConfig();
  const mealieReady = hasMealieConfig();

  useEffect(() => {
    let cancelled = false;
    async function loadMeals() {
      setIsLoading(true);
      try {
        const meals = await getRecipeSuggestions(inventory);
        if (!cancelled) setMealsWithStatus(meals);
      } catch (error) {
        console.error('Failed to load recipe suggestions', error);
        if (!cancelled) setMealsWithStatus([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadMeals();
    return () => { cancelled = true; };
  }, [inventory, configuredSource]);

  const filteredMeals = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return mealsWithStatus.filter(meal => {
      if (meal.matchPercent < minMatchPercent) return false;
      if (!query) return true;
      return (
        meal.title.toLowerCase().includes(query) ||
        meal.description.toLowerCase().includes(query) ||
        meal.ingredients.some(ing => ing.toLowerCase().includes(query))
      );
    });
  }, [mealsWithStatus, searchTerm, minMatchPercent]);

  const visibleMeals = useMemo(
    () => filteredMeals.slice(0, MAX_VISIBLE_MEALS),
    [filteredMeals]
  );

  const addAllMissing = async (meal: MealWithStatus) => {
    if (!session?.user) return;
    const items = meal.missing.map(name => ({
      user_id: session.user.id,
      name,
      quantity: '1',
    }));
    const { data: existing } = await supabase
      .from('shopping_list')
      .select('name')
      .eq('user_id', session.user.id);
    const existingNames = new Set((existing || []).map(e => e.name.toLowerCase()));
    const newItems = items.filter(i => !existingNames.has(i.name.toLowerCase()));
    if (newItems.length === 0) {
      toast.info('All items already in shopping list');
      return;
    }
    const { error } = await supabase.from('shopping_list').insert(newItems);
    if (!error) toast.success(`Added ${newItems.length} item${newItems.length > 1 ? 's' : ''} to shopping list`);
    else toast.error('Failed to add items');
  };

  return (
    <div className="p-4 pb-28 max-w-lg mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Meal Ideas</h1>
        <p className="text-sm text-muted-foreground">Based on what you have</p>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => navigate('/favorites')}>
            <Heart className="w-3.5 h-3.5 mr-1" /> Favorites
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => navigate('/meal-planner')}>
            <CalendarDays className="w-3.5 h-3.5 mr-1" /> Planner
          </Button>
        </div>

        {!hasValidSourceConfig && (
          <p className="text-xs text-warning mt-2">
            Invalid VITE_RECIPE_SOURCE value "{requestedSource}". Falling back to local.
          </p>
        )}
        {configuredSource === 'mealie' && !mealieReady && (
          <p className="text-xs text-warning mt-2">{getMealieConfigSummary()}</p>
        )}
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="glass-card p-1">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search meals or ingredients"
              className="pl-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[0, 25, 50, 75].map(pct => (
            <Button
              key={pct}
              type="button"
              variant={minMatchPercent === pct ? 'default' : 'outline'}
              size="sm"
              className="rounded-xl"
              onClick={() => setMinMatchPercent(pct)}
            >
              {pct === 0 ? 'All' : `${pct}%+`}
            </Button>
          ))}
        </div>

        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {Math.min(MAX_VISIBLE_MEALS, filteredMeals.length)} of {filteredMeals.length} recipes
          </p>
        )}
      </div>

      {/* Meal list */}
      <div className="space-y-3">
        {isLoading && (
          <div className="glass-card p-6 text-center text-sm text-muted-foreground shimmer">
            Loading meal ideas...
          </div>
        )}

        {!isLoading && filteredMeals.length === 0 && (
          <div className="glass-card p-6 text-center text-sm text-muted-foreground">
            No meal ideas found for that search or match level.
          </div>
        )}

        {visibleMeals.map((meal, i) => {
          const isExpanded = expandedId === meal.id;
          return (
            <div
              key={meal.id}
              className="glass-card overflow-hidden animate-fade-in"
              style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}
            >
              {/* Tappable header */}
              <button
                className="w-full text-left"
                onClick={() => setExpandedId(isExpanded ? null : meal.id)}
              >
                {meal.image && (
                  <div className="relative h-36 w-full overflow-hidden">
                    <img
                      src={meal.image}
                      alt={meal.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-2 left-3 right-3">
                      <h3 className="font-semibold text-sm leading-tight text-white drop-shadow-sm">{meal.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-white/80 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {meal.prepTime}
                        </span>
                        <span className="text-[11px] font-semibold text-white">{meal.matchPercent}%</span>
                        {meal.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white/90">{meal.category}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="p-4">
                  {!meal.image && (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm leading-tight">{meal.title}</h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {meal.prepTime}
                          </span>
                          <span className="text-xs font-semibold text-primary">{meal.matchPercent}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Match bar */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-muted rounded-full h-1.5">
                      <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${meal.matchPercent}%` }} />
                    </div>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    }
                  </div>
                </div>
              </button>

              {/* Expanded preview */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 animate-fade-in border-t border-border/40 pt-3">
                  {/* Description preview */}
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {meal.description}
                  </p>

                  {/* Ingredient pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {meal.owned.map(ing => (
                      <span key={ing} className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 flex items-center gap-0.5 font-medium">
                        <Check className="w-2.5 h-2.5" /> {ing}
                      </span>
                    ))}
                    {meal.missing.map(ing => (
                      <span key={ing} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border font-medium">
                        {ing}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 rounded-xl"
                      style={{ background: 'var(--gradient-primary)' }}
                      onClick={() => navigate(`/recipe/${meal.id}`)}
                    >
                      View Full Recipe <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                    {meal.missing.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => addAllMissing(meal)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
