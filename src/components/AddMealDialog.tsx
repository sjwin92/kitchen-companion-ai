import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { MealSlot } from '@/hooks/useMealPlans';
import type { FavoriteRecipe } from '@/hooks/useFavorites';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, Search, Loader2, Apple, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface AddMealDialogProps {
  addDialog: { date: Date; slot: MealSlot } | null;
  onClose: () => void;
  onAdd: (recipeId: string, title: string, image?: string) => Promise<void>;
  favorites: FavoriteRecipe[];
}

// Slot-based category mapping for filtering favorites & contextual search
const SLOT_CATEGORIES: Record<MealSlot, string[]> = {
  breakfast: ['breakfast', 'starter', 'dessert', 'miscellaneous'],
  lunch: ['beef', 'chicken', 'lamb', 'pork', 'seafood', 'pasta', 'vegetarian', 'vegan', 'goat', 'miscellaneous', 'side'],
  dinner: ['beef', 'chicken', 'lamb', 'pork', 'seafood', 'pasta', 'vegetarian', 'vegan', 'goat', 'miscellaneous', 'side'],
  snack: ['dessert', 'starter', 'miscellaneous', 'breakfast'],
};

const SLOT_SEARCH_HINTS: Record<MealSlot, string> = {
  breakfast: 'e.g. pancakes, omelette, porridge',
  lunch: 'e.g. salad, sandwich, soup',
  dinner: 'e.g. curry, pasta, steak',
  snack: 'e.g. cookies, fruit salad, hummus',
};

function matchesSlot(category: string | null, slot: MealSlot): boolean {
  if (!category) return true; // no category → show everywhere
  return SLOT_CATEGORIES[slot].some(c => category.toLowerCase().includes(c));
}

export default function AddMealDialog({ addDialog, onClose, onAdd, favorites }: AddMealDialogProps) {
  const navigate = useNavigate();
  const { inventory } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; thumb: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [customName, setCustomName] = useState('');

  const slot = addDialog?.slot ?? 'dinner';

  // Filter favorites by slot
  const filteredFavorites = useMemo(() => {
    if (!addDialog) return [];
    return favorites.filter(f => matchesSlot(f.category, addDialog.slot));
  }, [favorites, addDialog]);

  // Inventory items as quick-pick options for custom/snack
  const inventoryItems = useMemo(() => {
    if (!inventory.length) return [];
    return inventory.map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
    }));
  }, [inventory]);

  // Filter inventory by custom name input
  const filteredInventory = useMemo(() => {
    if (!customName.trim()) return inventoryItems.slice(0, 10);
    const q = customName.toLowerCase();
    return inventoryItems.filter(i => i.name.toLowerCase().includes(q));
  }, [inventoryItems, customName]);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `https://${projectId}.supabase.co/functions/v1/mealdb-proxy?path=${encodeURIComponent(`search.php?s=${q}`)}`;
      const res = await fetch(url, {
        headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` },
      });
      const data = await res.json();
      const meals = (data.meals ?? []).map((m: any) => ({ id: m.idMeal, name: m.strMeal, thumb: m.strMealThumb }));

      // For breakfast slot, also try filtering by category keyword
      setSearchResults(meals);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleAddCustom = async () => {
    const name = customName.trim();
    if (!name) return;
    await onAdd(`custom-${Date.now()}`, name, undefined);
    setCustomName('');
  };

  const { removeItem, updateItem } = useApp();

  const handlePickInventoryItem = async (item: { id: string; name: string; quantity: string }) => {
    await onAdd(`custom-${Date.now()}`, item.name, undefined);

    // Auto-deduct from inventory
    const currentQty = parseInt(item.quantity, 10);
    if (!isNaN(currentQty) && currentQty > 1) {
      await updateItem(item.id, { quantity: String(currentQty - 1) });
    } else {
      await removeItem(item.id);
    }

    setCustomName('');
    toast.success(`${item.name} deducted from stock`);
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setCustomName('');
    onClose();
  };

  return (
    <Dialog open={!!addDialog} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            {addDialog && `Add ${addDialog.slot} · ${format(addDialog.date, 'EEE, MMM d')}`}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={slot === 'snack' ? 'custom' : 'favorites'} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="favorites">Favorites</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          {/* Favorites tab — filtered by slot */}
          <TabsContent value="favorites" className="mt-3">
            {filteredFavorites.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <CalendarDays className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  {favorites.length > 0
                    ? `No favorites match ${slot}. Try the search or custom tab!`
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
            <form onSubmit={e => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
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
                    onClick={() => onAdd(`mealdb-${meal.id}`, meal.name, meal.thumb)}
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

          {/* Custom tab — free-text with inventory suggestions */}
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

            {/* Inventory quick-picks */}
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
