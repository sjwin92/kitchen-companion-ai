import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
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
      toast.success(`Updated ${trimmedName} quantity to ${newQty}`);
      return;
    }

    const { error } = await supabase.from('shopping_list').insert({
      user_id: session.user.id,
      name: trimmedName,
      quantity: qty,
    });
    if (!error) { setName(''); setQuantity(''); load(); }
  };

  const mergeQuantities = (a: string, b: string): string => {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
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

  return (
    <div className="p-4 pb-28 max-w-lg mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shopping List</h1>
          <p className="text-sm text-muted-foreground">{unchecked.length} item{unchecked.length !== 1 ? 's' : ''} to buy</p>
        </div>
        {checked.length > 0 && (
          <Button variant="outline" size="sm" className="rounded-xl" onClick={clearChecked}>
            Clear Done
          </Button>
        )}
      </div>

      {/* Add item */}
      <div className="glass-card p-3 flex gap-2">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Add item..."
          onKeyDown={e => e.key === 'Enter' && addItem()}
          className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Input
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          placeholder="Qty"
          onKeyDown={e => e.key === 'Enter' && addItem()}
          className="w-16 border-0 bg-transparent shadow-none focus-visible:ring-0 text-center"
        />
        <Button
          onClick={addItem}
          disabled={!name.trim()}
          size="icon"
          className="rounded-xl shrink-0"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Unchecked items */}
      {unchecked.length > 0 && (
        <div className="space-y-2">
          {unchecked.map((item, i) => (
            <div
              key={item.id}
              className="glass-card p-3.5 flex items-center gap-3 animate-fade-in"
              style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}
            >
              <Checkbox
                checked={false}
                onCheckedChange={() => toggleCheck(item)}
                className="rounded-lg"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold">{item.name}</span>
                <span className="text-xs text-muted-foreground ml-2 font-medium">{item.quantity}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-destructive/10" onClick={() => remove(item.id)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Checked items */}
      {checked.length > 0 && (
        <div className="space-y-2">
          <h2 className="section-title px-1">Done</h2>
          {checked.map(item => (
            <div key={item.id} className="glass-card p-3.5 flex items-center gap-3 opacity-50">
              <Checkbox
                checked={true}
                onCheckedChange={() => toggleCheck(item)}
                className="rounded-lg"
              />
              <span className="text-sm line-through flex-1 text-muted-foreground">{item.name}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-destructive/10" onClick={() => remove(item.id)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
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
  );
}
