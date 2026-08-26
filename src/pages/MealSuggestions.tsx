import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { passesUserDietaryFilters } from '@/lib/dietaryFilter';
import { catalogRecipeToMealSuggestion, listCatalogRecipes } from '@/services/betaCatalog';
import { recommendRecipes } from '@/lib/recommendationEngine';
import type { MealWithStatus } from '@/lib/mealMatching';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Check, Search, Plus, Heart, CalendarDays, Sparkles, Users, Loader2, LibraryBig } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useFavorites } from '@/hooks/useFavorites';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const MAX_VISIBLE_MEALS = 30;
type RankedMeal = MealWithStatus & { reasons: string[] };

export default function MealSuggestions() {
  const { inventory, session, preferences } = useApp();
  const navigate = useNavigate();
  const [mealsWithStatus, setMealsWithStatus] = useState<RankedMeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [minMatchPercent, setMinMatchPercent] = useState(0);
  const [generatorServings, setGeneratorServings] = useState(preferences.householdSize || 4);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMeals() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const recipes = await listCatalogRecipes();
        const monday = new Date();
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        const ranked = recommendRecipes({
          recipes,
          inventory,
          preferences,
          userSeed: session?.user.id ?? 'anonymous',
          weekKey: monday.toISOString().slice(0, 10),
          limit: MAX_VISIBLE_MEALS,
        });
        const meals: RankedMeal[] = ranked.map(({ recipe, reasons, missingIngredients }) => {
          const meal = catalogRecipeToMealSuggestion(recipe);
          const missingIds = new Set(missingIngredients.map((ingredient) => ingredient.id));
          const required = recipe.ingredients.filter((ingredient) => !ingredient.optional);
          const owned = required.filter((ingredient) => !missingIds.has(ingredient.id)).map((ingredient) => ingredient.name);
          const missing = missingIngredients.map((ingredient) => ingredient.name);
          return {
            ...meal,
            owned,
            missing,
            matchPercent: required.length === 0 ? 100 : Math.round((owned.length / required.length) * 100),
            reasons,
          };
        });
        if (!cancelled) setMealsWithStatus(meals);
      } catch (error) {
        console.error('Failed to load recipe suggestions', error);
        if (!cancelled) {
          setMealsWithStatus([]);
          setLoadError('The reviewed recipe catalogue could not be loaded. Please try again.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void loadMeals();
    return () => { cancelled = true; };
  }, [inventory, preferences, session?.user.id]);

  const filteredMeals = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return mealsWithStatus.filter(meal => {
      if (meal.matchPercent < minMatchPercent) return false;

      if (!passesUserDietaryFilters(meal.title, meal.ingredients, preferences)) return false;

      if (!query) return true;
      return (
        meal.title.toLowerCase().includes(query) ||
        (meal.category || '').toLowerCase().includes(query) ||
        meal.ingredients.some(ing => ing.toLowerCase().includes(query))
      );
    });
  }, [mealsWithStatus, searchTerm, minMatchPercent, preferences]);

  const visibleMeals = useMemo(() => filteredMeals.slice(0, MAX_VISIBLE_MEALS), [filteredMeals]);

  // Find the top featured meal with an image and expiring ingredients
  const featured = visibleMeals.find(m => m.image && m.matchPercent >= 50);

  const generateRecipe = async () => {
    if (!session?.user) { toast.error('Please sign in first'); return; }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-recipe', {
        body: {
          inventoryItems: inventory.map(i => ({ name: i.name, daysUntilExpiry: i.daysUntilExpiry })),
          dietaryPreferences: preferences.dietaryPreferences,
          allergies: preferences.allergies,
          dislikedIngredients: preferences.dislikedIngredients,
          servings: generatorServings,
          cuisinePreferences: preferences.preferredCuisines,
          cookingTime: preferences.cookingTime,
          cookingConfidence: preferences.cookingConfidence,
          maxPrepTime: preferences.maxPrepTime,
        },
      });
      if (error || data?.error) throw new Error(data?.error || 'Generation failed');
      if (!data?.user_recipe_id) throw new Error('Recipe draft could not be saved');
      setGeneratedRecipe(data);
      
      toast.success(`Generated: ${data.title}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate recipe');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 md:px-8 md:py-10 pb-28 md:pb-8 max-w-7xl mx-auto animate-fade-in">
      {/* Editorial header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight font-display leading-tight">
          Daily curation
        </h1>
        <p className="section-title mt-3 max-w-2xl">
          Reviewed recipes from the Kitchen Companion catalogue, ranked for your pantry, expiring food, tastes, time and goals.
        </p>
        <Button variant="outline" size="sm" className="mt-4 rounded-xl gap-2" onClick={() => navigate('/recipe-books')}>
          <LibraryBig className="w-4 h-4" /> Browse recipe books
        </Button>
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
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Pantry match — % of ingredients you already have</p>
          <div className="flex flex-wrap gap-2">
            {[0, 25, 50, 75].map(pct => (
              <Button key={pct} type="button" variant={minMatchPercent === pct ? 'default' : 'outline'} size="sm" className="rounded-xl" onClick={() => setMinMatchPercent(pct)}>
                {pct === 0 ? 'All' : `${pct}%`}
              </Button>
            ))}
          </div>
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
        <div className="glass-card p-6 text-center text-sm text-muted-foreground max-w-xl">
          {loadError ?? 'No reviewed catalogue recipes match these filters yet.'}
        </div>
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
              <div className="w-full text-left group">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <button
                    aria-label={`Open ${meal.title}`}
                    onClick={() => navigate(`/recipe/${meal.id}`)}
                    className="absolute inset-0 z-10"
                  />
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
                    aria-label={`Save ${meal.title}`}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(meal.id, meal.title, meal.image, meal.category); }}
                    className="absolute z-20 bottom-2.5 right-2.5 w-8 h-8 rounded-full bg-card/90 flex items-center justify-center hover:bg-card transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="text-sm font-bold leading-tight mb-1">{meal.title}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="w-3 h-3 text-primary" />
                  You have {meal.owned.length}/{meal.ingredients.length} ingredients
                </p>
                {meal.reasons[0] && <p className="text-xs text-primary mt-2">{meal.reasons[0]}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Explicit fallback: catalogue is always the primary recommendation source. */}
      <div className="glass-card p-5 mt-8 max-w-xl border-dashed">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-base font-bold">Can’t find the right fit?</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          As an optional fallback, ask Kitchen Companion to draft one new recipe from your pantry. AI drafts are kept separate from reviewed catalogue recipes.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <button aria-label="Decrease servings" onClick={() => setGeneratorServings(Math.max(1, generatorServings - 1))} className="w-7 h-7 rounded-md bg-muted font-bold">−</button>
            <span className="text-sm font-bold w-5 text-center">{generatorServings}</span>
            <button aria-label="Increase servings" onClick={() => setGeneratorServings(Math.min(12, generatorServings + 1))} className="w-7 h-7 rounded-md bg-muted font-bold">+</button>
          </div>
          <Button variant="outline" size="sm" className="ml-auto rounded-xl text-xs gap-1.5" onClick={generateRecipe} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {isGenerating ? 'Drafting…' : 'Draft one recipe with AI'}
          </Button>
        </div>
      </div>

      {/* Generated Recipe Dialog */}
      {generatedRecipe && (
        <Dialog open={!!generatedRecipe} onOpenChange={open => { if (!open) setGeneratedRecipe(null); }}>
          <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                {generatedRecipe.emoji && <span className="text-xl">{generatedRecipe.emoji}</span>}
                {generatedRecipe.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Generated image */}
              {generatedRecipe.image && (
                <img
                  src={generatedRecipe.image}
                  alt={generatedRecipe.title}
                  className="w-full h-48 rounded-xl object-cover"
                />
              )}
              <p className="text-sm text-muted-foreground">{generatedRecipe.description}</p>

              {/* Meta badges */}
              <div className="flex flex-wrap gap-2">
                {generatedRecipe.prep_time && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Prep: {generatedRecipe.prep_time}
                  </span>
                )}
                {generatedRecipe.cook_time && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border flex items-center gap-1">
                    🔥 Cook: {generatedRecipe.cook_time}
                  </span>
                )}
                {generatedRecipe.servings && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border flex items-center gap-1">
                    <Users className="w-3 h-3" /> Serves {generatedRecipe.servings}
                  </span>
                )}
                {generatedRecipe.cuisine && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {generatedRecipe.cuisine}
                  </span>
                )}
              </div>

              {/* Dietary tags */}
              {generatedRecipe.dietary_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {generatedRecipe.dietary_tags.map((tag: string) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{tag}</span>
                  ))}
                </div>
              )}

              {/* Pantry items used */}
              {generatedRecipe.pantry_items_used?.length > 0 && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Using from your pantry</p>
                  <p className="text-sm">{generatedRecipe.pantry_items_used.join(', ')}</p>
                </div>
              )}

              {/* Ingredients */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ingredients</p>
                <div className="bg-muted/40 rounded-xl border border-border/40 p-3 space-y-1.5">
                  {generatedRecipe.ingredients?.map((ing: string | { name: string; quantity: number; unit: string }, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span>{typeof ing === 'string' ? ing : `${ing.quantity} ${ing.unit} ${ing.name}`}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Instructions</p>
                <div className="space-y-3">
                  {generatedRecipe.instructions?.map((step: string, i: number) => (
                    <div key={i} className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nutrition */}
              {generatedRecipe.nutrition && (
                <div className="grid grid-cols-4 gap-2 text-center p-3 rounded-xl bg-muted/40 border border-border/40">
                  <div>
                    <p className="text-sm font-bold">{generatedRecipe.nutrition.calories}</p>
                    <p className="text-[10px] text-muted-foreground">kcal</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-500">{generatedRecipe.nutrition.protein_g}g</p>
                    <p className="text-[10px] text-muted-foreground">Protein</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-500">{generatedRecipe.nutrition.carbs_g}g</p>
                    <p className="text-[10px] text-muted-foreground">Carbs</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-rose-500">{generatedRecipe.nutrition.fat_g}g</p>
                    <p className="text-[10px] text-muted-foreground">Fat</p>
                  </div>
                </div>
              )}

              {/* Tip */}
              {generatedRecipe.tips && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-accent/50 border border-border/40">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm">{generatedRecipe.tips}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 rounded-xl text-xs gap-1.5"
                  onClick={async () => {
                    if (!session?.user) { toast.error('Please sign in'); return; }
                    const today = new Date();
                    const dateStr = today.toISOString().split('T')[0];
                    const { error } = await supabase.from('meal_plans').insert({
                      user_id: session.user.id,
                      recipe_id: generatedRecipe.user_recipe_id,
                      title: generatedRecipe.title,
                      planned_date: dateStr,
                      meal_slot: 'dinner',
                      image: generatedRecipe.image || null,
                    });
                    if (!error) {
                      toast.success('Added to meal plan!');
                    } else {
                      toast.error('Failed to add to plan');
                    }
                  }}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  Add to Plan
                </Button>
                <Button
                  size="sm"
                  variant={isFavorite(generatedRecipe.user_recipe_id) ? 'default' : 'outline'}
                  className="rounded-xl text-xs gap-1.5"
                  onClick={() => {
                    toggleFavorite(
                      generatedRecipe.user_recipe_id,
                      generatedRecipe.title,
                      generatedRecipe.image || undefined,
                      generatedRecipe.cuisine || undefined
                    );
                  }}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFavorite(generatedRecipe.user_recipe_id) ? 'fill-current' : ''}`} />
                  {isFavorite(generatedRecipe.user_recipe_id) ? 'Favorited' : 'Favorite'}
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                This private AI draft is saved once to your recipes. It cannot become public without editorial review.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
