import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearSavedShoppingLists,
  deleteSavedShoppingList,
  getSavedShoppingLists,
  type SavedShoppingList,
} from '@/lib/shoppingLists';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString();
}

export default function SavedLists() {
  const navigate = useNavigate();
  const [lists, setLists] = useState<SavedShoppingList[]>([]);

  useEffect(() => {
    setLists(getSavedShoppingLists());
  }, []);

  const totalItems = useMemo(
    () => lists.reduce((sum, list) => sum + list.items.length, 0),
    [lists]
  );

  const handleDelete = (id: string) => {
    deleteSavedShoppingList(id);
    setLists(getSavedShoppingLists());
    toast.success('List deleted.');
  };

  const handleClearAll = () => {
    clearSavedShoppingLists();
    setLists([]);
    toast.success('All saved lists cleared.');
  };

  const handleCopy = async (list: SavedShoppingList) => {
    const text = list.items.join('\n');
    await navigator.clipboard.writeText(text);
    toast.success('Copied list to clipboard!');
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4 animate-fade-in">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Saved Lists</h1>
          <p className="text-sm text-muted-foreground">
            {lists.length} saved list{lists.length === 1 ? '' : 's'} • {totalItems} total item{totalItems === 1 ? '' : 's'}
          </p>
        </div>

        {lists.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClearAll}>
            Clear All
          </Button>
        )}
      </div>

      {lists.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
          No saved shopping lists yet.
        </div>
      )}

      <div className="space-y-3">
        {lists.map(list => (
          <div key={list.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{list.recipeTitle}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Saved {formatDate(list.createdAt)}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full border border-border bg-muted text-muted-foreground whitespace-nowrap">
                  {list.items.length} item{list.items.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="bg-muted/40 rounded-lg border border-border">
                <div className="p-3 border-b border-border flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Items</span>
                </div>

                <div className="divide-y divide-border">
                  {list.items.map(item => (
                    <div key={item} className="p-3 text-sm">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleCopy(list)}>
                  <Copy className="w-4 h-4 mr-1" /> Copy
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleDelete(list.id)}>
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
