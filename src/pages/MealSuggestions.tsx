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
import { Clock, Check, ShoppingCart, Search, Plus, ArrowRight, Heart, CalendarDays, Sparkles, Users, Loader2, BookmarkPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useFavorites } from '@/hooks/useFavorites';
import { useMealLibrary } from '@/hooks/useMealLibrary';
import { useMealFeedback } from '@/hooks/useMealFeedback';
import RecipeFeedbackBar from '@/components/RecipeFeedbackBar';
import ProductInfoDialog from '@/components/ProductInfoDialog';
import MealFeedbackPanel from '@/components/MealFeedbackPanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const MAX_VISIBLE_MEALS = 30;

export default function MealSuggestions() {
  const { inventory, session, preferences } = useApp();
  const navigate = useNavigate();
  const [mealsWithStatus, setMealsWithStatus] = useState<MealWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [minMatchPercent, setMinMatchPercent] = useState(0);
  const [generatorServings, setGeneratorServings] = useState(preferences.householdSize || 4);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { saveMeal, trackSignal } = useMealLibrary();
  const { submitFeedback } = useMealFeedback();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);
  const [savedMealId, setSavedMealId] = useState<string | null>(null);
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

    // Build dietary exclusion lists from user preferences
    const nonVeganIngredients = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'shrimp', 'bacon', 'steak', 'turkey', 'egg', 'cheese', 'cream', 'butter', 'milk', 'yogurt', 'honey', 'duck', 'crab', 'lobster', 'anchov', 'gelatin', 'lard', 'suet', 'whey'];
    const nonVegIngredients = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'shrimp', 'bacon', 'steak', 'turkey', 'duck', 'crab', 'lobster', 'anchov', 'gelatin', 'lard', 'suet'];

    const prefs = preferences.dietaryPreferences.map(p => p.toLowerCase());
    const isVegan = prefs.some(p => p.includes('vegan') && !p.includes('non'));
    const isVegetarian = prefs.some(p => p.includes('vegetarian') || p.includes('plant'));
    const isGlutenFree = prefs.some(p => p.includes('gluten'));
    const isDairyFree = prefs.some(p => p.includes('dairy'));

    const containsAny = (meal: MealWithStatus, terms: string[]) => {
      const text = [meal.title, ...meal.ingredients].join(' ').toLowerCase();
      return terms.some(t => text.includes(t));
    };

    return mealsWithStatus.filter(meal => {
      if (meal.matchPercent < minMatchPercent) return false;

      // Apply user dietary preference filters automatically
      if (isVegan && containsAny(meal, nonVeganIngredients)) return false;
      if (isVegetarian && containsAny(meal, nonVegIngredients)) return false;
      if (isGlutenFree && containsAny(meal, ['flour', 'bread', 'pasta', 'wheat', 'barley', 'rye', 'couscous', 'noodle', 'spaghetti', 'penne', 'macaroni'])) return false;
      if (isDairyFree && containsAny(meal, ['cheese', 'cream', 'butter', 'milk', 'yogurt', 'whey'])) return false;

      // Apply disliked ingredients filter
      if (preferences.dislikedIngredients.length > 0) {
        const disliked = preferences.dislikedIngredients.map(d => d.toLowerCase());
        if (containsAny(meal, disliked)) return false;
      }

      // Apply allergy filter
      if (preferences.allergies.length > 0) {
        const allergies = preferences.allergies.map(a => a.toLowerCase());
        if (containsAny(meal, allergies)) return false;
      }

      // Search term filtering
      if (!query) return true;
      const dietaryTerms: Record<string, (m: MealWithStatus) => boolean> = {
        vegan: m => !containsAny(m, nonVeganIngredients),
        vegetarian: m => !containsAny(m, nonVegIngredients),
      };
      for (const [term, filterFn] of Object.entries(dietaryTerms)) {
        if (query === term || query === term.slice(0, -1)) return filterFn(meal);
      }
      return meal.title.toLowerCase().includes(query) || (meal.category || '').toLowerCase().includes(query) || meal.ingredients.some(ing => ing.toLowerCase().includes(query));
    });
  }, [mealsWithStatus, searchTerm, minMatchPercent, preferences.dietaryPreferences, preferences.dislikedIngredients, preferences.allergies]);

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
      setGeneratedRecipe(data);
      
      // Auto-save generated meal to library
      const entry = await saveMeal({
        title: data.title,
        description: data.description,
        image: data.image || null,
        instructions: data.instructions?.join('\n') || null,
        ingredients: data.ingredients?.map((ing: string) => ({ name: ing })) || [],
        nutrition: data.nutrition || {},
        dietary_tags: data.dietary_tags || [],
        cuisine: data.cuisine || null,
        prep_time: data.prep_time || null,
        source: 'generated',
        use_soon_items_used: data.pantry_items_used || [],
        generation_context: {
          servings: generatorServings,
          dietary: preferences.dietaryPreferences,
          inventory_count: inventory.length,
        },
      });
      if (entry) {
        setSavedMealId(entry.id);
        await trackSignal(entry.id, 'viewed');
      }
      
      toast.success(`Generated: ${data.title}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate recipe');
    } finally {
      setIsGenerating(false);
    }
  };

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
          <Button
            size="sm"
            className="ml-auto rounded-xl text-xs gap-1.5"
            style={{ background: 'var(--gradient-primary)' }}
            onClick={generateRecipe}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {isGenerating ? 'Generating…' : 'Generate Recipe'}
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
                  {generatedRecipe.ingredients?.map((ing: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span>{ing}</span>
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
                      recipe_id: savedMealId || generatedRecipe.title,
                      title: generatedRecipe.title,
                      planned_date: dateStr,
                      meal_slot: 'dinner',
                      image: generatedRecipe.image || null,
                    });
                    if (!error) {
                      if (savedMealId) await trackSignal(savedMealId, 'planned');
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
                  variant={isFavorite(savedMealId || generatedRecipe.title) ? 'default' : 'outline'}
                  className="rounded-xl text-xs gap-1.5"
                  onClick={() => {
                    toggleFavorite(
                      savedMealId || generatedRecipe.title,
                      generatedRecipe.title,
                      generatedRecipe.image || undefined,
                      generatedRecipe.cuisine || undefined
                    );
                  }}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFavorite(savedMealId || generatedRecipe.title) ? 'fill-current' : ''}`} />
                  {isFavorite(savedMealId || generatedRecipe.title) ? 'Favorited' : 'Favorite'}
                </Button>
              </div>

              {/* Feedback */}
              {savedMealId && (
                <MealFeedbackPanel
                  mealId={savedMealId}
                  onSubmit={async (id, type, note) => {
                    await submitFeedback(id, type, note);
                    toast.success('Feedback saved!');
                  }}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
