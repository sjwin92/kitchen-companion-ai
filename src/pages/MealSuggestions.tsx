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
import { Clock, Check, ShoppingCart, Search, Plus, ArrowRight, Heart, CalendarDays, Sparkles, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useFavorites } from '@/hooks/useFavorites';
import RecipeFeedbackBar from '@/components/RecipeFeedbackBar';

const MAX_VISIBLE_MEALS = 30;

export default function MealSuggestions() {
  const { inventory, session, preferences } = useApp();
  const navigate = useNavigate();
  const [mealsWithStatus, setMealsWithStatus] = useState<MealWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [minMatchPercent, setMinMatchPercent] = useState(0);
  const { isFavorite, toggleFavorite } = useFavorites();

  const configuredSource = getConfiguredRecipeSource();

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
      const dietaryTerms: Record<string, (m: MealWithStatus) => boolean> = {
        vegan: m => { const nonVegan = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'shrimp', 'bacon', 'steak', 'turkey', 'egg', 'cheese', 'cream', 'butter', 'milk', 'yogurt', 'honey']; return !nonVegan.some(nv => m.title.toLowerCase().includes(nv) || m.ingredients.map(i => i.toLowerCase()).join(' ').includes(nv)); },
        vegetarian: m => { const nonVeg = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'shrimp', 'bacon', 'steak', 'turkey']; return !nonVeg.some(nv => m.title.toLowerCase().includes(nv) || m.ingredients.map(i => i.toLowerCase()).join(' ').includes(nv)); },
      };
      for (const [term, filterFn] of Object.entries(dietaryTerms)) {
        if (query === term || query === term.slice(0, -1)) return filterFn(meal);
      }
      return meal.title.toLowerCase().includes(query) || (meal.category || '').toLowerCase().includes(query) || meal.ingredients.some(ing => ing.toLowerCase().includes(query));
    });
  }, [mealsWithStatus, searchTerm, minMatchPercent]);

  const visibleMeals = useMemo(() => filteredMeals.slice(0, MAX_VISIBLE_MEALS), [filteredMeals]);

  // Find the top featured meal with an image and expiring ingredients
  const featured = visibleMeals.find(m => m.image && m.matchPercent >= 50);

  const addAllMissing = async (meal: MealWithStatus) => {
    if (!session?.user) return;
    const items = meal.missing.map(name => ({ user_id: session.user.id, name, quantity: '1' }));
    const { data: existing } = await supabase.from('shopping_list').select('name').eq('user_id', session.user.id);
    const existingNames = new Set((existing || []).map(e => e.name.toLowerCase()));
    const newItems = items.filter(i => !existingNames.has(i.name.toLowerCase()));
    if (newItems.length === 0) { toast.info('All items already in shopping list'); return; }
    const { error } = await supabase.from('shopping_list').insert(newItems);
    if (!error) toast.success(`Added ${newItems.length} item${newItems.length > 1 ? 's' : ''} to shopping list`);
  };

  return (
    <div className="p-4 md:px-8 md:py-10 pb-28 md:pb-8 max-w-7xl mx-auto animate-fade-in">
      {/* Editorial header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight font-display leading-tight">
          Daily curation
        </h1>
        <p className="section-title mt-3 max-w-lg">
          Intelligent recommendations based on your current pantry and items expiring soon.
        </p>
      </div>

      {/* AI Recipe Generator card */}
      <div className="glass-card p-5 mb-6 max-w-xl">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">AI Recipe Generator</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Create a custom recipe using your current inventory and dietary preferences.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Servings</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <button
                  onClick={() => setGeneratorServings(Math.max(1, generatorServings - 1))}
                  className="w-6 h-6 rounded-md bg-muted flex items-center justify-center hover:bg-accent transition-colors text-xs font-bold"
                >
                  −
                </button>
                <span className="text-sm font-bold w-5 text-center">{generatorServings}</span>
                <button
                  onClick={() => setGeneratorServings(Math.min(12, generatorServings + 1))}
                  className="w-6 h-6 rounded-md bg-muted flex items-center justify-center hover:bg-accent transition-colors text-xs font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {preferences.dietaryPreferences.length > 0 && (
              <span>{preferences.dietaryPreferences.join(', ')}</span>
            )}
          </div>
          <Button size="sm" className="ml-auto rounded-xl text-xs gap-1.5" style={{ background: 'var(--gradient-primary)' }}>
            <Sparkles className="w-3.5 h-3.5" /> Generate Recipe
          </Button>
        </div>
      </div>

      {/* Featured recipe card */}
      {featured && (
        <button
          onClick={() => navigate(`/recipe/${featured.id}`)}
          className="w-full max-w-xl rounded-xl overflow-hidden text-left group mb-8"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="relative">
            <img src={featured.image} alt={featured.title} className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            {/* Badges */}
            <div className="absolute top-3 left-3 flex gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-card/90 text-foreground">
                Featured Selection
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-primary text-primary-foreground">
                {featured.matchPercent}% Pantry Match
              </span>
            </div>
            {/* Title overlay */}
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">Suggested</p>
              <h3 className="text-xl font-bold text-white">{featured.title}</h3>
              <p className="text-xs text-white/80 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> You have {featured.owned.length}/{featured.ingredients.length} ingredients
              </p>
            </div>
          </div>
        </button>
      )}

      {/* Search & filter */}
      <div className="max-w-xl space-y-3 mb-6">
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
            <Button key={pct} type="button" variant={minMatchPercent === pct ? 'default' : 'outline'} size="sm" className="rounded-xl" onClick={() => setMinMatchPercent(pct)}>
              {pct === 0 ? 'All' : `${pct}%+`}
            </Button>
          ))}
        </div>
        {!isLoading && (
          <p className="text-xs text-muted-foreground">{Math.min(MAX_VISIBLE_MEALS, filteredMeals.length)} of {filteredMeals.length} recipes</p>
        )}
      </div>

      {/* Recipe grid — large image cards */}
      {isLoading && (
        <div className="glass-card p-6 text-center text-sm text-muted-foreground shimmer max-w-xl">Loading meal ideas...</div>
      )}

      {!isLoading && filteredMeals.length === 0 && (
        <div className="glass-card p-6 text-center text-sm text-muted-foreground max-w-xl">No meal ideas found.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleMeals.map((meal, i) => {
          // Check if any owned ingredients are expiring
          const expiringOwned = meal.owned.filter(name => {
            const inv = inventory.find(it => it.name.toLowerCase() === name.toLowerCase());
            return inv && (inv.status === 'use-today' || inv.status === 'use-soon');
          });

          return (
            <div
              key={meal.id}
              className="glass-card overflow-hidden animate-fade-in"
              style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}
            >
              {/* Image with badges */}
              <button onClick={() => navigate(`/recipe/${meal.id}`)} className="w-full text-left group">
                <div className="relative aspect-[4/3] overflow-hidden">
                  {meal.image ? (
                    <img src={meal.image} alt={meal.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-surface-high flex items-center justify-center">
                      <span className="text-3xl">🍽️</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                  {/* Expiring badge */}
                  {expiringOwned.length > 0 && (
                    <span className="absolute top-2.5 left-2.5 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-warning text-warning-foreground">
                      Uses expiring: {expiringOwned[0]} {expiringOwned.length > 1 ? `+${expiringOwned.length - 1}` : ''}
                    </span>
                  )}

                  {/* Match badge */}
                  <span className="absolute bottom-2.5 left-2.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-card/90 text-foreground">
                    {meal.matchPercent}% Match
                  </span>

                  {/* Add button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(meal.id, meal.title, meal.image, meal.category); }}
                    className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full bg-card/90 flex items-center justify-center hover:bg-card transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </button>

              {/* Info */}
              <div className="p-4">
                <h3 className="text-sm font-bold leading-tight mb-1">{meal.title}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="w-3 h-3 text-primary" />
                  You have {meal.owned.length}/{meal.ingredients.length} ingredients
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
