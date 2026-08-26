import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { passesUserDietaryFilters } from '@/lib/dietaryFilter';
import { catalogRecipeToMealSuggestion, listCatalogRecipes } from '@/services/betaCatalog';
import { recommendRecipes } from '@/lib/recommendationEngine';
import type { MealWithStatus } from '@/lib/mealMatching';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, BookOpen, Clock, FlaskConical, Search, Plus, Heart, CalendarDays, Sparkles, Users, Loader2, LibraryBig } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useFavorites } from '@/hooks/useFavorites';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RecipeCard from '@/components/RecipeCard';

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
      <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="section-title mb-2">Recipes</p>
          <h1 className="max-w-3xl text-3xl font-extrabold tracking-[-0.035em] md:text-5xl">Cook from what you have</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            Trusted recipes, ordered by your pantry, food that needs using and the way your household eats.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => navigate('/favorites')}>
            <Heart className="h-4 w-4" /> Saved
          </Button>
          <Button className="gap-2 rounded-xl" onClick={() => navigate('/recipe-books')}>
            <LibraryBig className="h-4 w-4" /> Recipe books
          </Button>
        </div>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          {featured && (
            <button
              onClick={() => navigate(`/recipe/${featured.id}`)}
              className="group relative mb-6 block aspect-[16/7] min-h-64 w-full overflow-hidden rounded-2xl text-left shadow-[var(--shadow-card)]"
            >
              <img src={featured.image} alt={featured.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-[#35463d]">Today’s best fit</span>
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white md:p-6">
                <p className="text-xs font-semibold text-white/75">{featured.matchPercent}% pantry match</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">{featured.title}</h2>
                <p className="mt-2 text-sm text-white/80">You already have {featured.owned.length} of {featured.ingredients.length} ingredients</p>
              </div>
            </button>
          )}

          <div className="mb-6 rounded-2xl border border-border/70 bg-card p-3 shadow-[var(--shadow-xs)]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search recipes or ingredients"
                className="h-11 border-0 bg-surface-low pl-10 shadow-none focus-visible:ring-1"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">Pantry match</span>
              {[0, 25, 50, 75].map(pct => (
                <Button key={pct} type="button" variant={minMatchPercent === pct ? 'default' : 'ghost'} size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => setMinMatchPercent(pct)}>
                  {pct === 0 ? 'Any' : `${pct}%+`}
                </Button>
              ))}
              {!isLoading && <span className="ml-auto text-xs text-muted-foreground">{filteredMeals.length} recipe{filteredMeals.length === 1 ? '' : 's'}</span>}
            </div>
          </div>

          {isLoading && (
            <div className="grid gap-5 sm:grid-cols-2">
              {[0, 1, 2, 3].map(item => <div key={item} className="h-80 animate-pulse rounded-2xl border border-border/60 bg-muted/50" />)}
            </div>
          )}

          {!isLoading && filteredMeals.length === 0 && (
            <div className="rounded-2xl border border-border/70 bg-card p-7 md:p-9">
              <span className="text-4xl" aria-hidden="true">🍲</span>
              <h2 className="mt-4 text-xl font-extrabold">{loadError ? 'The recipe shelf did not load' : mealsWithStatus.length === 0 ? 'The first recipe packs are in review' : 'No recipes match those filters'}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                {loadError ?? (mealsWithStatus.length === 0
                  ? 'The beta catalogue only publishes recipes after cooking, allergen and rights checks. Three Kitchen Companion starter packs are being prepared now.'
                  : 'Try a lower pantry match or search for a different ingredient.')}
              </p>
              {mealsWithStatus.length === 0 && !loadError && (
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-foreground/80">
                  <span className="rounded-full bg-muted px-3 py-1.5">🌿 Plant-forward starters</span>
                  <span className="rounded-full bg-muted px-3 py-1.5">⏱️ Five-ingredient weeknights</span>
                  <span className="rounded-full bg-muted px-3 py-1.5">🥕 Use it up</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {visibleMeals.map(meal => {
              const expiringOwned = meal.owned.filter(name => {
                const inv = inventory.find(it => it.name.toLowerCase() === name.toLowerCase());
                return inv && (inv.status === 'use-today' || inv.status === 'use-soon');
              });
              return (
                <RecipeCard
                  key={meal.id}
                  title={meal.title}
                  image={meal.image}
                  prepTime={meal.prepTime}
                  matchPercent={meal.matchPercent}
                  ownedCount={meal.owned.length}
                  ingredientCount={meal.ingredients.length}
                  reason={meal.reasons[0]}
                  expiringLabel={expiringOwned[0]}
                  saved={isFavorite(meal.id)}
                  onOpen={() => navigate(`/recipe/${meal.id}`)}
                  onSave={() => toggleFavorite(meal.id, meal.title, meal.image, meal.category)}
                />
              );
            })}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <button onClick={() => navigate('/recipe-books')} className="w-full rounded-2xl bg-[#31433a] p-5 text-left text-white shadow-[var(--shadow-card)] transition-colors hover:bg-[#3b4d43]">
            <BookOpen className="h-5 w-5 text-white/80" />
            <h2 className="mt-8 text-xl font-extrabold">Your recipe shelf</h2>
            <p className="mt-2 text-sm leading-5 text-white/70">Collect trusted creator packs and plan directly from them.</p>
            <span className="mt-5 flex items-center gap-1 text-xs font-bold">Browse books <ArrowRight className="h-3.5 w-3.5" /></span>
          </button>

          <div className="rounded-2xl border border-dashed border-border bg-card p-5">
            <FlaskConical className="h-5 w-5 text-muted-foreground" />
            <h2 className="mt-4 text-base font-extrabold">Recipe lab</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">If the catalogue has no fit, create one private draft from your pantry. It never enters the public shelf without review.</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button aria-label="Decrease servings" onClick={() => setGeneratorServings(Math.max(1, generatorServings - 1))} className="h-8 w-8 rounded-full bg-muted text-sm font-bold">−</button>
                <span className="w-5 text-center text-sm font-bold">{generatorServings}</span>
                <button aria-label="Increase servings" onClick={() => setGeneratorServings(Math.min(12, generatorServings + 1))} className="h-8 w-8 rounded-full bg-muted text-sm font-bold">+</button>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={generateRecipe} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {isGenerating ? 'Drafting…' : 'Create private draft'}
              </Button>
            </div>
          </div>
        </aside>
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
