import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, ShoppingBag, Search, Share2, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
}

// Categorize shopping items
function categorize(name: string): string {
  const n = name.toLowerCase();
  const produce = ['tomato', 'onion', 'garlic', 'pepper', 'carrot', 'potato', 'spinach', 'kale', 'lettuce', 'zucchini', 'broccoli', 'mushroom', 'celery', 'cucumber', 'avocado', 'lemon', 'lime', 'parsley', 'cilantro', 'basil', 'herb', 'apple', 'banana', 'orange', 'berry', 'grape'];
  const dairy = ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'ricotta', 'mozzarella', 'parmesan', 'egg'];
  const pantry = ['rice', 'pasta', 'flour', 'sugar', 'salt', 'oil', 'vinegar', 'sauce', 'spice', 'can', 'bean', 'lentil', 'stock', 'broth'];
  if (produce.some(p => n.includes(p))) return 'Produce';
  if (dairy.some(d => n.includes(d))) return 'Dairy';
  if (pantry.some(p => n.includes(p))) return 'Pantry';
  return 'Other';
}

export default function ShoppingList() {
  const { session } = useApp();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });
    if (data) setItems(data.map(d => ({ id: d.id, name: d.name, quantity: d.quantity, checked: d.checked })));
  }, [session?.user?.id]);

  useEffect(() => { load(); }, [load]);

  const addItem = async () => {
    if (!name.trim() || !session?.user) return;
    const trimmedName = name.trim();
    const qty = quantity.trim() || '1';
    const existing = items.find(i => i.name.toLowerCase() === trimmedName.toLowerCase() && !i.checked);
    if (existing) {
      const newQty = mergeQuantities(existing.quantity, qty);
      await supabase.from('shopping_list').update({ quantity: newQty }).eq('id', existing.id);
      setItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: newQty } : i));
      setName(''); setQuantity('');
      toast.success(`Updated ${trimmedName}`);
      return;
    }
    const { error } = await supabase.from('shopping_list').insert({ user_id: session.user.id, name: trimmedName, quantity: qty });
    if (!error) { setName(''); setQuantity(''); load(); }
  };

  const mergeQuantities = (a: string, b: string): string => {
    const numA = parseFloat(a); const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) return String(numA + numB);
    return `${a} + ${b}`;
  };

  const toggleCheck = async (item: ShoppingItem) => {
    await supabase.from('shopping_list').update({ checked: !item.checked }).eq('id', item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i));
  };

  const remove = async (id: string) => {
    await supabase.from('shopping_list').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const clearChecked = async () => {
    const checked = items.filter(i => i.checked);
    if (checked.length === 0) return;
    for (const item of checked) {
      await supabase.from('shopping_list').delete().eq('id', item.id);
    }
    setItems(prev => prev.filter(i => !i.checked));
    toast.success(`Cleared ${checked.length} item${checked.length > 1 ? 's' : ''}`);
  };

  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);

  // Group unchecked by category
  const grouped = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {};
    unchecked.forEach(item => {
      const cat = categorize(item.name);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [unchecked]);

  return (
    <div className="p-4 md:px-8 md:py-10 pb-28 md:pb-8 max-w-7xl mx-auto animate-fade-in">
      {/* Editorial header */}
      <div className="mb-8">
        <p className="section-title mb-2">Provisioning</p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-display leading-tight">
          The Weekly<br />
          <span className="italic">Market List</span>
        </h1>
      </div>

      {/* Search / Add */}
      <div className="max-w-xl mb-6">
        <div className="glass-card p-1.5 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Add an item manually..."
              onKeyDown={e => e.key === 'Enter' && addItem()}
              className="pl-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
          <Input
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="Qty"
            onKeyDown={e => e.key === 'Enter' && addItem()}
            className="w-16 border-0 bg-transparent shadow-none focus-visible:ring-0 text-center"
          />
          <Button onClick={addItem} disabled={!name.trim()} size="icon" className="rounded-xl shrink-0" style={{ background: 'var(--gradient-primary)' }}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 uppercase tracking-wider font-bold">
          <Share2 className="w-3.5 h-3.5" /> Export
        </Button>
        <Button size="sm" className="rounded-xl text-xs gap-1.5 uppercase tracking-wider font-bold" style={{ background: 'var(--gradient-primary)' }}>
          <Plus className="w-3.5 h-3.5" /> Quick Add
        </Button>
        {checked.length > 0 && (
          <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={clearChecked}>
            Clear Done ({checked.length})
          </Button>
        )}
      </div>

      {/* Floating print button */}
      <button className="fixed bottom-24 md:bottom-8 right-6 z-40 bg-primary text-primary-foreground px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wider hover:shadow-xl transition-shadow">
        <Printer className="w-4 h-4" /> Print List
      </button>

      {/* Items grouped by category */}
      <div className="max-w-xl space-y-6">
        {Object.entries(grouped).map(([category, catItems]) => (
          <div key={category} className="glass-card overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-border/40">
              <h3 className="text-base font-bold">{category}</h3>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {catItems.length} Items
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {catItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-low/50 transition-colors">
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => toggleCheck(item)}
                    className="rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold">{item.name}</span>
                    {item.quantity !== '1' && (
                      <span className="text-xs text-muted-foreground ml-2">({item.quantity})</span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground font-medium">{item.quantity}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-destructive/10" onClick={() => remove(item.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Checked items */}
        {checked.length > 0 && (
          <div className="glass-card overflow-hidden opacity-60">
            <div className="px-5 py-3 border-b border-border/40">
              <h3 className="text-base font-bold">Done</h3>
            </div>
            <div className="divide-y divide-border/30">
              {checked.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Checkbox checked={true} onCheckedChange={() => toggleCheck(item)} className="rounded-lg" />
                  <span className="text-sm line-through flex-1 text-muted-foreground">{item.name}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-destructive/10" onClick={() => remove(item.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <div className="icon-container mx-auto mb-3 bg-muted">
              <ShoppingBag className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Your shopping list is empty</p>
            <p className="text-xs mt-1">Add items above or from meal suggestions</p>
          </div>
        )}
      </div>
    </div>
  );
}
