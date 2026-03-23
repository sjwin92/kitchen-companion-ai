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
import { Clock, Check, ShoppingCart, Search, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_VISIBLE_MEALS = 30;

export default function MealSuggestions() {
  const { inventory, session } = useApp();
  const navigate = useNavigate();
  const [mealsWithStatus, setMealsWithStatus] = useState<MealWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [minMatchPercent, setMinMatchPercent] = useState(0);

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

        if (!cancelled) {
          setMealsWithStatus(meals);
        }
      } catch (error) {
        console.error('Failed to load recipe suggestions', error);

        if (!cancelled) {
          setMealsWithStatus([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadMeals();

    return () => {
      cancelled = true;
    };
  }, [inventory]);

  const filteredMeals = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return mealsWithStatus.filter(meal => {
      if (meal.matchPercent < minMatchPercent) {
        return false;
      }

      if (!query) {
        return true;
      }

      const titleMatch = meal.title.toLowerCase().includes(query);
      const descriptionMatch = meal.description.toLowerCase().includes(query);
      const ingredientMatch = meal.ingredients.some(ingredient =>
        ingredient.toLowerCase().includes(query)
      );

      return titleMatch || descriptionMatch || ingredientMatch;
    });
  }, [mealsWithStatus, searchTerm, minMatchPercent]);

  const visibleMeals = useMemo(
    () => filteredMeals.slice(0, MAX_VISIBLE_MEALS),
    [filteredMeals]
  );

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4 animate-fade-in">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Meal Ideas</h1>
            <p className="text-sm text-muted-foreground">Based on what you have</p>
          </div>

          <span className="text-xs px-2 py-1 rounded-full border border-border bg-muted text-muted-foreground whitespace-nowrap">
            Source: {configuredSource}
          </span>
        </div>

        {!hasValidSourceConfig && (
          <p className="text-xs text-amber-600 mt-2">
            Invalid VITE_RECIPE_SOURCE value "{requestedSource}". Falling back to local.
          </p>
        )}

        {requestedSource === 'mock' && (
          <p className="text-xs text-muted-foreground mt-2">
            Legacy source value "mock" detected. Using local recipes.
          </p>
        )}

        {configuredSource === 'mealie' && !mealieReady && (
          <p className="text-xs text-amber-600 mt-2">
            {getMealieConfigSummary()}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search meals or ingredients"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={minMatchPercent === 0 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMinMatchPercent(0)}
          >
            All
          </Button>
          <Button
            type="button"
            variant={minMatchPercent === 25 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMinMatchPercent(25)}
          >
            25%+
          </Button>
          <Button
            type="button"
            variant={minMatchPercent === 50 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMinMatchPercent(50)}
          >
            50%+
          </Button>
          <Button
            type="button"
            variant={minMatchPercent === 75 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMinMatchPercent(75)}
          >
            75%+
          </Button>
        </div>

        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            Showing {Math.min(MAX_VISIBLE_MEALS, filteredMeals.length)} of {filteredMeals.length} filtered recipes
            {mealsWithStatus.length !== filteredMeals.length ? ` (${mealsWithStatus.length} total matches)` : ''}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {isLoading && (
          <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
            Loading meal ideas...
          </div>
        )}

        {!isLoading && filteredMeals.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
            No meal ideas found for that search or match level.
          </div>
        )}

        {visibleMeals.map(meal => (
          <div key={meal.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{meal.title}</h3>
                <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                  <Clock className="w-3 h-3" /> {meal.prepTime}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{meal.description}</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-2">
                <div
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{ width: `${meal.matchPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-primary">{meal.matchPercent}%</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {meal.owned.map(ing => (
                <span
                  key={ing}
                  className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> {ing}
                </span>
              ))}
              {meal.missing.map(ing => (
                <span
                  key={ing}
                  className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
                >
                  {ing}
                </span>
              ))}
            </div>

            {meal.missing.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => navigate(`/missing/${meal.id}`)}
                >
                  <ShoppingCart className="w-4 h-4 mr-1" /> Missing {meal.missing.length}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!session?.user) return;
                    const items = meal.missing.map(name => ({
                      user_id: session.user.id,
                      name,
                      quantity: '1',
                    }));
                    // Dedup: check existing items first
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
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
