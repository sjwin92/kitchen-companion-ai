import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import {
  clearSavedShoppingLists,
  getSavedShoppingLists,
  type SavedShoppingList,
} from '@/lib/shoppingLists';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ShoppingCart,
  Copy,
  Check,
  Trash2,
  Package,
  ChefHat,
} from 'lucide-react';
import { toast } from 'sonner';

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean)));
}

export default function Shopping() {
  const navigate = useNavigate();
  const { inventory } = useApp();
  const [savedLists, setSavedLists] = useState<SavedShoppingList[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSavedLists(getSavedShoppingLists());
  }, []);

  const mealPlanItems = useMemo(
    () => uniqueStrings(savedLists.flatMap(list => list.items)),
    [savedLists]
  );

  const restockItems = useMemo(
    () =>
      uniqueStrings(
        inventory
          .filter(item => (item.status as string) === 'used')
          .map(item => item.name)
      ),
    [inventory]
  );

  const combinedItems = useMemo(
    () => uniqueStrings([...mealPlanItems, ...restockItems]),
    [mealPlanItems, restockItems]
  );

  const uncheckedItems = useMemo(
    () => combinedItems.filter(item => !checked.has(item)),
    [combinedItems, checked]
  );

  const toggleChecked = (item: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    });
  };

  const copyList = async () => {
    if (uncheckedItems.length === 0) {
      toast.info('Nothing left to copy.');
      return;
    }

    await navigator.clipboard.writeText(uncheckedItems.join('\n'));
    toast.success('Copied shopping list!');
  };

  const handleClearSavedMealLists = () => {
    clearSavedShoppingLists();
    setSavedLists([]);
    toast.success('Cleared saved meal lists.');
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div>
        <h1 className="text-2xl font-bold">Shopping</h1>
        <p className="text-sm text-muted-foreground">
          Combined list from saved meals and used items
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <ChefHat className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Meal List Items</span>
          </div>
          <div className="text-2xl font-bold">{mealPlanItems.length}</div>
          <div className="text-xs text-muted-foreground">{savedLists.length} saved list{savedLists.length === 1 ? '' : 's'}</div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Restock Items</span>
          </div>
          <div className="text-2xl font-bold">{restockItems.length}</div>
          <div className="text-xs text-muted-foreground">Marked used in inventory</div>
        </div>
      </div>

      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-3 bg-muted/50 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Combined Shopping List ({combinedItems.length})
            </span>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyList}>
              <Copy className="w-4 h-4 mr-1" /> Copy
            </Button>
          </div>
        </div>

        {combinedItems.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No shopping items yet. Save a meal list or mark inventory items as used.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {combinedItems.map(item => (
              <button
                key={item}
                onClick={() => toggleChecked(item)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    checked.has(item) ? 'bg-primary border-primary' : 'border-border'
                  }`}
                >
                  {checked.has(item) && <Check className="w-3 h-3 text-primary-foreground" />}
                </div>

                <span
                  className={`text-sm ${
                    checked.has(item) ? 'line-through text-muted-foreground' : 'font-medium'
                  }`}
                >
                  {item}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
