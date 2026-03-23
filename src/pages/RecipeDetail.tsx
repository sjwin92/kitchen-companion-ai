import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { getRecipeById } from '@/services/recipes/recipeProvider';
import { ingredientMatches } from '@/lib/mealMatching';
import type { MealSuggestion } from '@/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Check, ShoppingCart, Plus, ChefHat } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { inventory, session } = useApp();
  const [recipe, setRecipe] = useState<MealSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) { setIsLoading(false); return; }
      setIsLoading(true);
      try {
        const data = await getRecipeById(id);
        if (!cancelled) setRecipe(data);
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

  // Parse description into steps (split by sentence-ending periods followed by space + capital)
  const steps = parseSteps(recipe.description);

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

  return (
    <div className="p-4 pb-28 max-w-lg mx-auto space-y-5 animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to meals
      </button>

      {/* Header */}
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

        {/* Match bar */}
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
          <h2 className="font-semibold text-sm">Ingredients</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ownedIngredients.length} of {recipe.ingredients.length} in your kitchen
          </p>
        </div>
        <div className="divide-y divide-border/40">
          {recipe.ingredients.map(ing => {
            const owned = activeInventory.some(item => ingredientMatches(item.name, ing));
            return (
              <div key={ing} className="flex items-center gap-3 px-4 py-2.5">
                <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                  owned ? 'bg-success/15' : 'bg-muted'
                }`}>
                  {owned && <Check className="w-3 h-3 text-success" />}
                </div>
                <span className={`text-sm ${owned ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {ing}
                </span>
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
            <p className="text-sm text-foreground/90 leading-relaxed">{recipe.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Parse a description blob into numbered steps */
function parseSteps(description: string): string[] {
  // Try splitting on sentence boundaries (period + space + capital letter)
  const sentences = description
    .split(/\.(?:\s+)(?=[A-Z])/)
    .map(s => s.trim().replace(/\.$/, '').trim())
    .filter(s => s.length > 10);

  if (sentences.length >= 2) return sentences;
  return [description];
}
