import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, ShoppingCart } from 'lucide-react';
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
    const { error } = await supabase.from('shopping_list').insert({
      user_id: session.user.id,
      name: name.trim(),
      quantity: quantity.trim() || '1',
    });
    if (!error) { setName(''); setQuantity(''); load(); }
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
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shopping List</h1>
          <p className="text-sm text-muted-foreground">{unchecked.length} item{unchecked.length !== 1 ? 's' : ''} to buy</p>
        </div>
        {checked.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearChecked}>
            Clear Done
          </Button>
        )}
      </div>

      {/* Add item */}
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Add item..."
          onKeyDown={e => e.key === 'Enter' && addItem()}
          className="flex-1"
        />
        <Input
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          placeholder="Qty"
          onKeyDown={e => e.key === 'Enter' && addItem()}
          className="w-20"
        />
        <Button onClick={addItem} disabled={!name.trim()} size="icon">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Unchecked items */}
      {unchecked.length > 0 && (
        <div className="space-y-1.5">
          {unchecked.map(item => (
            <div key={item.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <Checkbox checked={false} onCheckedChange={() => toggleCheck(item)} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{item.quantity}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(item.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Checked items */}
      {checked.length > 0 && (
        <div className="space-y-1.5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Done</h2>
          {checked.map(item => (
            <div key={item.id} className="bg-card/50 border border-border rounded-xl p-3 flex items-center gap-3 opacity-60">
              <Checkbox checked={true} onCheckedChange={() => toggleCheck(item)} />
              <span className="text-sm line-through flex-1">{item.name}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(item.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Your shopping list is empty</p>
        </div>
      )}
    </div>
  );
}
