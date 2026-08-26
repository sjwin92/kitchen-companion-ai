import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { MealSlot } from '@/hooks/useMealPlans';
import type { FavoriteRecipe } from '@/hooks/useFavorites';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, Search, Loader2, Apple, Plus, Flame } from 'lucide-react';
import { passesUserDietaryFilters } from '@/lib/dietaryFilter';
import { planInventoryMeal } from '@/lib/mealPlanning';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { searchRecipes } from '@/services/recipes/recipeProvider';
import { listRecommendedCatalogRecipes } from '@/services/betaCatalog';
import type { CatalogRecipe } from '@/types';

interface AddMealDialogProps {
  addDialog: { date: Date; slot: MealSlot } | null;
  onClose: () => void;
  onAdd: (recipeId: string, title: string, image?: string) => Promise<void>;
  favorites: FavoriteRecipe[];
}

const SLOT_CATEGORIES: Record<MealSlot, string[]> = {
  breakfast: ['breakfast', 'starter', 'dessert', 'miscellaneous'],
  lunch: ['beef', 'chicken', 'lamb', 'pork', 'seafood', 'pasta', 'vegetarian', 'vegan', 'goat', 'miscellaneous', 'side'],
  dinner: ['beef', 'chicken', 'lamb', 'pork', 'seafood', 'pasta', 'vegetarian', 'vegan', 'goat', 'miscellaneous', 'side'],
  snack: ['dessert', 'starter', 'miscellaneous', 'breakfast'],
  lunchbox: ['side', 'vegetarian', 'miscellaneous', 'starter', 'pasta', 'chicken'],
};

const SLOT_SEARCH_HINTS: Record<MealSlot, string> = {
  breakfast: 'e.g. pancakes, omelette, porridge',
  lunch: 'e.g. salad, sandwich, soup',
  dinner: 'e.g. curry, pasta, steak',
  snack: 'e.g. cookies, fruit salad, hummus',
  lunchbox: 'e.g. wrap, pasta salad, sandwich',
};

function matchesSlot(category: string | null, slot: MealSlot): boolean {
  if (!category) return true;
  return SLOT_CATEGORIES[slot].some(c => category.toLowerCase().includes(c));
}

export default function AddMealDialog({ addDialog, onClose, onAdd, favorites }: AddMealDialogProps) {
  const navigate = useNavigate();
  const { inventory, preferences } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; thumb: string; ingredients: string[] }>>([]);
  const [searching, setSearching] = useState(false);
  const [customName, setCustomName] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('');
  const [catalogRecipes, setCatalogRecipes] = useState<CatalogRecipe[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const slot = addDialog?.slot ?? 'dinner';

  const filteredFavorites = useMemo(() => {
    if (!addDialog) return [];
    return favorites.filter(f =>
      matchesSlot(f.category, addDialog.slot) &&
      passesUserDietaryFilters(f.title, [], preferences)
    );
  }, [favorites, addDialog, preferences]);

  const inventoryItems = useMemo(() => {
    if (!inventory.length) return [];
    return inventory.map(item => ({ id: item.id, name: item.name, quantity: item.quantity }));
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    if (!customName.trim()) return inventoryItems.slice(0, 10);
    const q = customName.toLowerCase();
    return inventoryItems.filter(i => i.name.toLowerCase().includes(q));
  }, [inventoryItems, customName]);

  const filteredCatalogRecipes = useMemo(() => {
    const query = catalogFilter.trim().toLowerCase();
    return catalogRecipes.filter(recipe => {
      const mealTypes = recipe.mealTypes.map(type => type.toLowerCase());
      const matchesMealSlot = mealTypes.length === 0
        || mealTypes.includes(slot)
        || (slot === 'lunchbox' && (mealTypes.includes('lunch') || mealTypes.includes('snack')));
      const matchesQuery = !query
        || recipe.title.toLowerCase().includes(query)
        || recipe.ingredients.some(ingredient => ingredient.name.toLowerCase().includes(query));
      return matchesMealSlot
        && matchesQuery
        && passesUserDietaryFilters(recipe.title, recipe.ingredients.map(ingredient => ingredient.name), preferences);
    });
  }, [catalogRecipes, catalogFilter, preferences, slot]);

  useEffect(() => {
    if (!addDialog) return;
    let active = true;
    setLoadingCatalog(true);
    listRecommendedCatalogRecipes({ limit: 100 })
      .then(recommendations => {
        if (active) setCatalogRecipes(recommendations.map(item => item.recipe));
      })
      .catch(() => {
        if (active) {
          setCatalogRecipes([]);
          toast.error('Reviewed catalogue recommendations are unavailable');
        }
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });
    return () => { active = false; };
  }, [addDialog]);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const meals = (await searchRecipes(q))
        .map((meal) => ({
          id: meal.id,
          name: meal.title,
          thumb: meal.image ?? '',
          ingredients: meal.ingredients,
        }))
        .filter((m: { name: string; ingredients: string[] }) =>
          passesUserDietaryFilters(m.name, m.ingredients, preferences)
        );
      setSearchResults(meals);
    } catch {
      toast.error('Catalogue search failed');
    } finally {
      setSearching(false);
    }
  }, [preferences]);

  // Auto-search with debounce
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(q), 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, doSearch]);

  const handleAddCustom = async () => {
    const name = customName.trim();
    if (!name) return;
    if (!passesUserDietaryFilters(name, [], preferences)) {
      toast.error('That meal conflicts with your saved food preferences. Update it or change your preferences first.');
      return;
    }
    await onAdd(`custom-${Date.now()}`, name, undefined);
    setCustomName('');
  };

  const handlePickCatalogItem = async (recipe: CatalogRecipe) => {
    await onAdd(recipe.id, recipe.title, recipe.imagePath ?? undefined);
  };

  const handlePickInventoryItem = async (item: { id: string; name: string; quantity: string }) => {
    await planInventoryMeal(onAdd, item);
    setCustomName('');
    toast.success(`${item.name} planned from stock — confirm it after eating to update inventory`);
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setCustomName('');
    setCatalogFilter('');
    onClose();
  };

  // Determine default tab based on slot
  const defaultTab = slot === 'breakfast' || slot === 'snack' ? 'quick' : 'favorites';

  return (
    <Dialog open={!!addDialog} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {addDialog && `Add ${addDialog.slot} · ${format(addDialog.date, 'EEE, MMM d')}`}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} key={`${addDialog?.date}-${addDialog?.slot}`} className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="quick" className="text-xs">Quick Add</TabsTrigger>
            <TabsTrigger value="favorites" className="text-xs">Favorites</TabsTrigger>
            <TabsTrigger value="search" className="text-xs">Search</TabsTrigger>
            <TabsTrigger value="custom" className="text-xs">Custom</TabsTrigger>
          </TabsList>

          {/* Quick Add — catalog + inventory */}
          <TabsContent value="quick" className="mt-3 space-y-3">
            <Input
              placeholder={`Filter ${slot} options...`}
              value={catalogFilter}
              onChange={e => setCatalogFilter(e.target.value)}
              className="h-8 text-xs"
            />

            {/* Inventory quick-picks at top */}
            {inventoryItems.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">From your stock</p>
                <div className="flex flex-wrap gap-1.5">
                  {inventoryItems
                    .filter(i => !catalogFilter.trim() || i.name.toLowerCase().includes(catalogFilter.toLowerCase()))
                    .slice(0, 8)
                    .map(item => (
                      <button
                        key={item.id}
                        onClick={() => handlePickInventoryItem(item)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs hover:bg-primary/10 transition-colors"
                      >
                        <Apple className="w-3 h-3 text-primary" />
                        {item.name}
                        <span className="text-muted-foreground">({item.quantity})</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Reviewed database catalogue */}
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {loadingCatalog && (
                <div className="flex items-center justify-center gap-2 py-5 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading reviewed recipes…
                </div>
              )}
              {!loadingCatalog && filteredCatalogRecipes.map(recipe => (
                <button
                  key={recipe.id}
                  onClick={() => handlePickCatalogItem(recipe)}
                  className="w-full flex items-center gap-2.5 rounded-lg border border-border/50 px-2.5 py-2 hover:bg-accent/50 transition-colors text-left"
                >
                  {recipe.imagePath ? (
                    <img src={recipe.imagePath} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-base">🍽️</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{recipe.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {recipe.prepMinutes + recipe.cookMinutes} min · serves {recipe.servings}
                    </p>
                  </div>
                  {typeof recipe.nutrition.calories === 'number' && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                      <Flame className="w-3 h-3" />
                      {Math.round(recipe.nutrition.calories)}
                    </span>
                  )}
                </button>
              ))}

              {!loadingCatalog && filteredCatalogRecipes.length === 0 && (
                <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center">
                  <p className="text-xs font-medium">No reviewed {slot} recipes match yet</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Try Search or Custom. Draft recipes stay private until their safety and rights review is complete.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Favorites tab */}
          <TabsContent value="favorites" className="mt-3">
            {filteredFavorites.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <CalendarDays className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  {favorites.length > 0
                    ? `No favorites match ${slot}. Try Quick Add or Search!`
                    : 'Save some favorites first!'}
                </p>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { handleClose(); navigate('/meals'); }}>
                  Browse Meals
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFavorites.map(fav => (
                  <button
                    key={fav.id}
                    className="w-full flex items-center gap-3 rounded-xl border border-border/50 p-2 hover:bg-accent/50 transition-colors text-left"
                    onClick={() => onAdd(fav.recipe_id, fav.title, fav.image ?? undefined)}
                  >
                    {fav.image && (
                      <img src={fav.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{fav.title}</p>
                      {fav.category && <p className="text-[10px] text-muted-foreground">{fav.category}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Search tab */}
          <TabsContent value="search" className="mt-3 space-y-3">
            <form onSubmit={e => { e.preventDefault(); doSearch(searchQuery.trim()); }} className="flex gap-2">
              <Input
                placeholder={SLOT_SEARCH_HINTS[slot]}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 h-9 text-sm"
              />
              <Button type="submit" size="sm" variant="outline" disabled={searching || searchQuery.trim().length < 2}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map(meal => (
                  <button
                    key={meal.id}
                    className="w-full flex items-center gap-3 rounded-xl border border-border/50 p-2 hover:bg-accent/50 transition-colors text-left"
                    onClick={() => onAdd(meal.id, meal.name, meal.thumb)}
                  >
                    {meal.thumb && (
                      <img src={meal.thumb} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    )}
                    <p className="text-sm font-medium truncate flex-1">{meal.name}</p>
                  </button>
                ))}
              </div>
            )}

            {searchResults.length === 0 && !searching && searchQuery.length >= 2 && (
              <p className="text-xs text-muted-foreground text-center py-4">No results found</p>
            )}
          </TabsContent>

          {/* Custom tab */}
          <TabsContent value="custom" className="mt-3 space-y-3">
            <form onSubmit={e => { e.preventDefault(); handleAddCustom(); }} className="flex gap-2">
              <Input
                placeholder={slot === 'snack' ? 'e.g. Apple, Yogurt, Granola bar' : `Type a ${slot} name...`}
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                className="flex-1 h-9 text-sm"
              />
              <Button type="submit" size="sm" disabled={!customName.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </form>

            {filteredInventory.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">From your stock</p>
                <div className="flex flex-wrap gap-1.5">
                  {filteredInventory.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handlePickInventoryItem(item)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border/60 text-xs hover:bg-accent/50 transition-colors"
                    >
                      <Apple className="w-3 h-3 text-muted-foreground" />
                      {item.name}
                      <span className="text-muted-foreground">({item.quantity})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredInventory.length === 0 && customName.trim() && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No matching items in stock — press + to add "{customName.trim()}" anyway
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
