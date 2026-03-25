import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { getRecipeById } from '@/services/recipes/recipeProvider';
import { ingredientMatches } from '@/lib/mealMatching';
import type { MealSuggestion } from '@/types';
import PairingSuggestions from '@/components/PairingSuggestions';
import RecipeFeedbackBar from '@/components/RecipeFeedbackBar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Check, ShoppingCart, Plus, ChefHat, ExternalLink, Heart, CalendarPlus, Minus, Users, UtensilsCrossed, X, Camera } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { useInteractions } from '@/hooks/useInteractions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { inventory, preferences, session } = useApp();
  const [recipe, setRecipe] = useState<MealSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { track } = useInteractions();
  const defaultServings = preferences.householdSize || 4;
  const [servings, setServings] = useState(defaultServings);
  const baseServings = 4;
  const [pairedRecipe, setPairedRecipe] = useState<MealSuggestion | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) { setIsLoading(false); return; }
      setIsLoading(true);
      try {
        const data = await getRecipeById(id);
        if (!cancelled) {
          setRecipe(data);
          if (data) track('recipe_viewed', { recipeId: id, recipeTitle: data.title });
        }
      } catch {
        if (!cancelled) setRecipe(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (isLoading) {
    return (
      <div className="p-4 pb-28 max-w-lg mx-auto animate-fade-in">
        <div className="glass-card p-6 text-center text-muted-foreground">Loading recipe...</div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="p-4 pb-28 max-w-lg mx-auto animate-fade-in">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="glass-card p-6 text-center text-muted-foreground">Recipe not found</div>
      </div>
    );
  }

  const activeInventory = inventory.filter(i => (i.status as string) !== 'used');
  const ownedIngredients = recipe.ingredients.filter(ing =>
    activeInventory.some(item => ingredientMatches(item.name, ing))
  );
  const missingIngredients = recipe.ingredients.filter(ing =>
    !activeInventory.some(item => ingredientMatches(item.name, ing))
  );
  const matchPercent = Math.round((ownedIngredients.length / recipe.ingredients.length) * 100);

  const steps = parseSteps(recipe.instructions || recipe.description);

  const addMissingToShoppingList = async () => {
    if (!session?.user || missingIngredients.length === 0) return;
    const items = missingIngredients.map(name => ({
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

  const handleCookTogether = (sideRecipe: MealSuggestion) => {
    // Toggle: if same recipe already selected, deselect
    if (pairedRecipe?.id === sideRecipe.id) {
      setPairedRecipe(null);
    } else {
      setPairedRecipe(sideRecipe);
    }
  };

  const handleLogCombinedMeal = () => {
    // Navigate to meal log with combined recipe data
    const combinedRecipes = [
      {
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        ingredients: recipe.ingredients,
        measures: recipe.measures,
      },
      ...(pairedRecipe ? [{
        id: pairedRecipe.id,
        title: pairedRecipe.title,
        image: pairedRecipe.image,
        ingredients: pairedRecipe.ingredients,
        measures: pairedRecipe.measures,
      }] : []),
    ];
    navigate('/meal-log', { state: { combinedRecipes, servings } });
  };

  // Compute combined ingredients for the paired view
  const pairedMissing = pairedRecipe
    ? pairedRecipe.ingredients.filter(ing =>
        !activeInventory.some(item => ingredientMatches(item.name, ing))
      )
    : [];

  return (
    <div className="pb-28 max-w-lg mx-auto animate-fade-in">
      {/* Hero image */}
      {recipe.image && (
        <div className="relative h-56 w-full overflow-hidden">
          <img src={recipe.image} alt={recipe.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={() => toggleFavorite(recipe.id, recipe.title, recipe.image, recipe.category)}
              className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
            >
              <Heart className={`w-4 h-4 ${isFavorite(recipe.id) ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
            <button
              onClick={() => navigate('/meal-planner')}
              className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
            >
              <CalendarPlus className="w-4 h-4" />
            </button>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-xl font-bold text-white leading-tight">{recipe.title}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-white/80 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {recipe.prepTime}
              </span>
              {recipe.category && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 text-white/90">{recipe.category}</span>
              )}
              {recipe.area && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 text-white/90">{recipe.area}</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-4 space-y-5">
        {/* Back + header when no image */}
        {!recipe.image && (
          <>
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to meals
            </button>
            <div className="glass-card p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="icon-container bg-primary/10 shrink-0">
                  <ChefHat className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold leading-tight">{recipe.title}</h1>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {recipe.prepTime}
                    </span>
                    <span className="text-xs font-semibold text-primary">{matchPercent}% match</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Match bar */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Ingredient match</span>
            <span className="text-sm font-bold text-primary">{matchPercent}%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-full h-2">
              <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${matchPercent}%` }} />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">
              {ownedIngredients.length}/{recipe.ingredients.length}
            </span>
          </div>
        </div>

        {/* Ingredients */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm">Ingredients</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ownedIngredients.length} of {recipe.ingredients.length} in your kitchen
                </p>
              </div>
              {/* Serving adjuster */}
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <button
                  onClick={() => setServings(Math.max(1, servings - 1))}
                  className="w-6 h-6 rounded-md bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-sm font-bold w-4 text-center">{servings}</span>
                <button
                  onClick={() => setServings(servings + 1)}
                  className="w-6 h-6 rounded-md bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
          <div className="divide-y divide-border/40">
            {recipe.ingredients.map((ing, idx) => {
              const owned = activeInventory.some(item => ingredientMatches(item.name, ing));
              const rawMeasure = recipe.measures?.[idx] || '';
              const scaledMeasure = scaleMeasure(rawMeasure, servings / baseServings);
              return (
                <div key={ing} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                    owned ? 'bg-success/15' : 'bg-muted'
                  }`}>
                    {owned && <Check className="w-3 h-3 text-success" />}
                  </div>
                  <span className={`text-sm flex-1 ${owned ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {ing}
                  </span>
                  {scaledMeasure && (
                    <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                      {scaledMeasure}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Add missing to shopping */}
        {missingIngredients.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => navigate(`/missing/${recipe.id}`)}
            >
              <ShoppingCart className="w-4 h-4 mr-1.5" />
              View Missing ({missingIngredients.length})
            </Button>
            <Button
              className="rounded-xl"
              onClick={addMissingToShoppingList}
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Plus className="w-4 h-4 mr-1" /> Add All
            </Button>
          </div>
        )}

        {/* Instructions */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h2 className="font-semibold text-sm">Instructions</h2>
          </div>
          <div className="p-4 space-y-4">
            {steps.length > 1 ? (
              steps.map((step, i) => (
                <div key={i} className="flex gap-3 animate-fade-in" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}>
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                    {i + 1}
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed pt-1">{step}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{recipe.instructions || recipe.description}</p>
            )}
            {isInstructionTruncated(recipe.instructions || recipe.description) && (
              <p className="text-xs text-muted-foreground italic bg-muted/50 rounded-lg p-3">
                ⚠️ This recipe's instructions appear to be incomplete. Try searching for "{recipe.title}" online for the full method.
              </p>
            )}
          </div>
        </div>

        {/* YouTube link */}
        {recipe.youtubeUrl && (
          <a
            href={recipe.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-card p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <span className="text-lg">▶️</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Watch Video Tutorial</p>
              <p className="text-xs text-muted-foreground">See how it's made on YouTube</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>
        )}

        {/* Feedback actions */}
        <div className="glass-card p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">How do you feel about this recipe?</p>
          <RecipeFeedbackBar
            recipeId={recipe.id}
            recipeTitle={recipe.title}
            recipeImage={recipe.image}
            recipeCategory={recipe.category}
          />
        </div>

        {/* Pairing suggestions */}
        <PairingSuggestions
          recipeTitle={recipe.title}
          category={recipe.category}
          area={recipe.area}
          ingredients={recipe.ingredients}
          onCookTogether={handleCookTogether}
          selectedPairingId={pairedRecipe?.id}
        />

        {/* Cook Together combined panel */}
        {pairedRecipe && (
          <div className="glass-card overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-4 border-b border-border/50 bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-sm">Cook Together</h2>
                </div>
                <button
                  onClick={() => setPairedRecipe(null)}
                  className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {recipe.title} + {pairedRecipe.title}
              </p>
            </div>

            {/* Side dish ingredients card */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                {pairedRecipe.image && (
                  <img src={pairedRecipe.image} alt={pairedRecipe.title} className="w-10 h-10 rounded-lg object-cover" />
                )}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">{pairedRecipe.title}</h3>
                  <p className="text-[10px] text-muted-foreground">{pairedRecipe.ingredients.length} ingredients</p>
                </div>
              </div>
              <div className="divide-y divide-border/40 rounded-lg border border-border/50 overflow-hidden">
                {pairedRecipe.ingredients.map((ing, idx) => {
                  const owned = activeInventory.some(item => ingredientMatches(item.name, ing));
                  const rawMeasure = pairedRecipe.measures?.[idx] || '';
                  const scaledMeasure = scaleMeasure(rawMeasure, servings / baseServings);
                  return (
                    <div key={ing} className="flex items-center gap-3 px-3 py-2">
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                        owned ? 'bg-success/15' : 'bg-muted'
                      }`}>
                        {owned && <Check className="w-2.5 h-2.5 text-success" />}
                      </div>
                      <span className={`text-xs flex-1 ${owned ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {ing}
                      </span>
                      {scaledMeasure && (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">
                          {scaledMeasure}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add combined missing to shopping */}
              {pairedMissing.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {pairedMissing.length} missing ingredient{pairedMissing.length > 1 ? 's' : ''} for this side
                </p>
              )}
            </div>

            {/* Log combined meal CTA */}
            <div className="p-4 pt-0">
              <Button
                onClick={handleLogCombinedMeal}
                className="w-full gap-2"
                style={{ background: 'var(--gradient-primary)' }}
              >
                <Camera className="w-4 h-4" />
                Log Combined Meal
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Scale a measurement string by a ratio (e.g. "200g" × 1.5 → "300g").
 * Handles common formats: "200g", "1/2 cup", "2 tbsp", "1 1/2 tsp", plain numbers.
 */
function scaleMeasure(measure: string, ratio: number): string {
  if (!measure.trim() || ratio === 1) return measure;

  // Try to find a leading number (including fractions like 1/2, 1 1/2)
  const match = measure.match(/^(\d+\s+)?(\d+)\/(\d+)(.*)/);
  if (match) {
    const whole = match[1] ? parseInt(match[1].trim()) : 0;
    const num = parseInt(match[2]);
    const den = parseInt(match[3]);
    const rest = match[4];
    const value = (whole + num / den) * ratio;
    return formatNum(value) + rest;
  }

  const numMatch = measure.match(/^([\d.]+)(.*)/);
  if (numMatch) {
    const value = parseFloat(numMatch[1]) * ratio;
    return formatNum(value) + numMatch[2];
  }

  return measure;
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  // Show common fractions for readability
  const frac = n % 1;
  const whole = Math.floor(n);
  if (Math.abs(frac - 0.25) < 0.05) return whole ? `${whole} 1/4` : '1/4';
  if (Math.abs(frac - 0.33) < 0.05) return whole ? `${whole} 1/3` : '1/3';
  if (Math.abs(frac - 0.5) < 0.05) return whole ? `${whole} 1/2` : '1/2';
  if (Math.abs(frac - 0.67) < 0.05) return whole ? `${whole} 2/3` : '2/3';
  if (Math.abs(frac - 0.75) < 0.05) return whole ? `${whole} 3/4` : '3/4';
  return n.toFixed(1);
}

function parseSteps(text: string): string[] {
  if (!text) return [];

  // TheMealDB often uses \r\n between steps
  const byNewline = text
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s.length > 5)
    // Remove step numbers like "STEP 1" or "1." at the start
    .map(s => s.replace(/^(?:step\s*\d+[.:)]\s*|\d+[.:)\s]+)/i, '').trim())
    .filter(s => s.length > 5);

  if (byNewline.length >= 2) return byNewline;

  // Fallback: split on sentence boundaries
  const sentences = text
    .split(/\.(?:\s+)(?=[A-Z])/)
    .map(s => s.trim().replace(/\.$/, '').trim())
    .filter(s => s.length > 10);

  if (sentences.length >= 2) return sentences;
  return [text];
}
