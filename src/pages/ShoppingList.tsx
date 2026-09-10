import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, ShoppingBag, Search, Share2, Printer, PackagePlus, Lightbulb, BarChart2, Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { getAisle, getCheaperAlternative, fetchPricesFor, type Aisle } from '@/lib/shoppingCost';
import { useBasketCompare } from '@/hooks/useBasketCompare';
import ReceiptReconcileDialog from '@/components/ReceiptReconcileDialog';
import { useCapabilities } from '@/hooks/useCapabilities';
import { appError, errorMessage } from '@/lib/appError';

interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
}

const AISLE_ORDER: Aisle[] = ['Produce', 'Meat & Fish', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen', 'Other'];

export default function ShoppingList() {
  const { session, refreshInventory } = useApp();
  const userId = session?.user?.id;
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const { baskets, loading: comparingPrices, error: compareError, compare, clear: clearCompare } = useBasketCompare();
  const { getCapability, isLoading: capabilitiesLoading } = useCapabilities();
  const livePricingAvailable = getCapability('live_pricing')?.available ?? false;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoadError(null);
    const { data, error } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) {
      setLoadError('We could not load your saved shopping list.');
      throw appError(error, 'We could not load your saved shopping list.');
    }
    setItems((data ?? []).map(d => ({ id: d.id, name: d.name, quantity: d.quantity, checked: d.checked })));
  }, [userId]);

  useEffect(() => { void load().catch(() => undefined); }, [load]);

  const addItem = async () => {
    if (!name.trim() || !session?.user) return;
    const trimmedName = name.trim();
    const qty = quantity.trim() || '1';
    const existing = items.find(i => i.name.toLowerCase() === trimmedName.toLowerCase() && !i.checked);
    setBusyAction('add');
    try {
      if (existing) {
        const newQty = mergeQuantities(existing.quantity, qty);
        const { data, error } = await supabase.from('shopping_list').update({ quantity: newQty }).eq('id', existing.id).select('id').maybeSingle();
        if (error || !data) throw appError(error, `We could not update ${trimmedName}.`);
        setItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: newQty } : i));
        setName(''); setQuantity('');
        toast.success(`Updated ${trimmedName}`);
        return;
      }
      const { error } = await supabase.from('shopping_list').insert({ user_id: session.user.id, name: trimmedName, quantity: qty });
      if (error) throw appError(error, `We could not add ${trimmedName}.`);
      setName(''); setQuantity('');
      await load();
      toast.success(`Added ${trimmedName}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Your shopping item was not saved.'));
    } finally {
      setBusyAction(null);
    }
  };

  const mergeQuantities = (a: string, b: string): string => {
    const numA = parseFloat(a); const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) return String(numA + numB);
    return `${a} + ${b}`;
  };

  const toggleCheck = async (item: ShoppingItem) => {
    setBusyAction(item.id);
    try {
      const { data, error } = await supabase.from('shopping_list').update({ checked: !item.checked }).eq('id', item.id).select('id').maybeSingle();
      if (error || !data) throw appError(error, `We could not update ${item.name}.`);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i));
    } catch (error) {
      toast.error(errorMessage(error, 'Your shopping item was not updated.'));
    } finally {
      setBusyAction(null);
    }
  };

  const remove = async (id: string) => {
    setBusyAction(id);
    try {
      const { data, error } = await supabase.from('shopping_list').delete().eq('id', id).select('id').maybeSingle();
      if (error || !data) throw appError(error, 'We could not remove this item.');
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      toast.error(errorMessage(error, 'This item was not removed.'));
    } finally {
      setBusyAction(null);
    }
  };

  const clearChecked = async () => {
    const checked = items.filter(i => i.checked);
    if (checked.length === 0) return;
    setBusyAction('clear');
    try {
      const { data, error } = await supabase.from('shopping_list').delete().in('id', checked.map(item => item.id)).select('id');
      if (error || (data?.length ?? 0) !== checked.length) throw appError(error, 'We could not clear all completed items.');
      setItems(prev => prev.filter(i => !i.checked));
      toast.success(`Cleared ${checked.length} item${checked.length > 1 ? 's' : ''}`);
    } catch (error) {
      await load().catch(() => undefined);
      toast.error(errorMessage(error, 'Completed items were not cleared.'));
    } finally {
      setBusyAction(null);
    }
  };

  const moveCheckedToInventory = async () => {
    const checkedItems = items.filter(i => i.checked);
    if (checkedItems.length === 0) return;

    setBusyAction('move');
    const payload = checkedItems.map(item => {
      const aisle = getAisle(item.name);
      const location = aisle === 'Frozen' ? 'freezer' : ['Produce', 'Meat & Fish', 'Dairy & Eggs'].includes(aisle) ? 'fridge' : 'cupboard';
      const daysUntilExpiry = aisle === 'Meat & Fish' ? 3 : aisle === 'Produce' || aisle === 'Bakery' ? 5 : aisle === 'Dairy & Eggs' ? 10 : aisle === 'Frozen' ? 60 : aisle === 'Pantry' ? 90 : 30;
      return { id: item.id, location, daysUntilExpiry };
    });
    const { data: moved, error } = await supabase.rpc('move_shopping_items_to_inventory' as never, { p_items: payload } as never);
    if (error) {
      toast.error('Nothing was moved. Your shopping list is unchanged.');
      setBusyAction(null);
      return;
    }
    try {
      await Promise.all([load(), refreshInventory()]);
      toast.success(`Added ${moved ?? checkedItems.length} item${checkedItems.length === 1 ? '' : 's'} to inventory`);
    } catch (error) {
      toast.error(errorMessage(error, 'Items moved, but the screen could not refresh.'));
    } finally {
      setBusyAction(null);
    }
  };

  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);

  // Refresh prices when unchecked items change
  useEffect(() => {
    if (unchecked.length === 0) { setPrices(new Map()); return; }
    fetchPricesFor(unchecked.map(i => i.name)).then(setPrices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unchecked.length, unchecked.map(i => i.name).join('|')]);

  // Group unchecked by aisle in canonical order
  const grouped = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {};
    unchecked.forEach(item => {
      const cat = getAisle(item.name);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return AISLE_ORDER
      .filter(a => groups[a]?.length)
      .map(a => [a, groups[a]] as [Aisle, ShoppingItem[]]);
  }, [unchecked]);

  // Basket total: sum prices × numeric qty (defaults to 1)
  const basketTotal = useMemo(() => {
    let total = 0;
    for (const item of unchecked) {
      const p = prices.get(item.name);
      if (p === undefined) continue;
      const qty = parseFloat(item.quantity) || 1;
      total += p * qty;
    }
    return total;
  }, [unchecked, prices]);

  const pricedCount = unchecked.filter(i => prices.has(i.name)).length;

  const handleQuickAdd = async () => {
    if (!quickAddText.trim() || !session?.user) return;
    setQuickAddLoading(true);
    const lines = quickAddText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    const rows: Array<{ user_id: string; name: string; quantity: string }> = [];
    for (const line of lines) {
      // Support "2x Milk" or "Milk x2" or "Milk 2" or just "Milk"
      const match = line.match(/^(\d+)\s*[xX]?\s+(.+)$/) || line.match(/^(.+?)\s+[xX]?(\d+)$/);
      let itemName: string;
      let qty: string;
      if (match && match.length === 3) {
        const isLeadingNum = /^\d/.test(line);
        itemName = isLeadingNum ? match[2].trim() : match[1].trim();
        qty = isLeadingNum ? match[1] : match[2];
      } else {
        itemName = line;
        qty = '1';
      }
      if (!itemName) continue;
      rows.push({ user_id: session.user.id, name: itemName, quantity: qty });
    }
    try {
      if (rows.length === 0) return;
      const { error } = await supabase.from('shopping_list').insert(rows);
      if (error) throw appError(error, 'None of those items were added.');
      await load();
      setQuickAddText('');
      setQuickAddOpen(false);
      toast.success(`Added ${rows.length} item${rows.length !== 1 ? 's' : ''}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Those items were not saved.'));
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleExport = () => {
    if (items.length === 0) { toast('Your list is empty'); return; }
    const sections: string[] = ['🛒 Shopping List\n'];
    // Unchecked grouped by aisle
    for (const [aisle, aisleItems] of grouped) {
      sections.push(`\n── ${aisle} ──`);
      for (const item of aisleItems) {
        const qty = item.quantity !== '1' ? ` (${item.quantity})` : '';
        sections.push(`• ${item.name}${qty}`);
      }
    }
    if (checked.length > 0) {
      sections.push('\n── Got ──');
      for (const item of checked) {
        sections.push(`✓ ${item.name}`);
      }
    }
    const text = sections.join('\n');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => toast.success('List copied to clipboard'));
    } else {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'shopping-list.txt'; a.click();
      URL.revokeObjectURL(url);
      toast.success('List downloaded');
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="p-4 md:px-8 md:py-10 pb-28 md:pb-8 max-w-7xl mx-auto animate-fade-in">
      {loadError && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <span>{loadError}</span>
          <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => void load().catch(error => toast.error(errorMessage(error, 'Could not reload shopping list.')))}>Retry</Button>
        </div>
      )}
      {/* Header */}
      <div className="mb-8">
        <p className="section-title mb-2">Shopping</p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-display leading-tight">
          Your Weekly<br />
          <span className="italic">Shopping List</span>
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
          <Button aria-label="Add shopping item" onClick={addItem} disabled={!name.trim() || busyAction === 'add'} size="icon" className="h-11 w-11 rounded-xl shrink-0" style={{ background: 'var(--gradient-primary)' }}>
            {busyAction === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 uppercase tracking-wider font-bold" onClick={handleExport}>
          <Share2 className="w-3.5 h-3.5" /> Export
        </Button>
        <Button size="sm" className="rounded-xl text-xs gap-1.5 uppercase tracking-wider font-bold" style={{ background: 'var(--gradient-primary)' }} onClick={() => setQuickAddOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Quick Add
        </Button>
        <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 uppercase tracking-wider font-bold" onClick={() => setScanOpen(true)}>
          <Receipt className="w-3.5 h-3.5" /> Scan Receipt
        </Button>
        {checked.length > 0 && (
          <>
            <Button size="sm" disabled={busyAction === 'move'} className="min-h-11 rounded-xl text-xs gap-1.5 font-bold" onClick={moveCheckedToInventory}>
              <PackagePlus className="w-3.5 h-3.5" /> Move to Inventory ({checked.length})
            </Button>
            <Button variant="outline" size="sm" disabled={busyAction === 'clear'} className="min-h-11 rounded-xl text-xs" onClick={clearChecked}>
              Clear Done
            </Button>
          </>
        )}
      </div>

      {/* Basket cost estimate + retailer comparison */}
      {unchecked.length > 0 && (
        <div className="max-w-xl mb-6 space-y-3">
          {/* Single estimate from cached prices */}
          {basketTotal > 0 && (
            <div className="glass-card p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                  Estimated basket
                </p>
                <p className="text-2xl font-extrabold font-display">
                  £{basketTotal.toFixed(2)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground text-right">
                {pricedCount} of {unchecked.length} items priced
                <br />
                <span className="text-[10px]">UK average estimates</span>
              </p>
            </div>
          )}

          {/* Retailer price comparison */}
          {baskets.length === 0 && !comparingPrices && livePricingAvailable && (
            <button
              onClick={() => compare(unchecked.map(i => ({ name: i.name, quantity: i.quantity })))}
              className="w-full glass-card p-4 flex items-center gap-3 hover:bg-surface-low/60 transition-colors text-left"
            >
              <div className="icon-container bg-muted shrink-0">
                <BarChart2 className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold">Compare supermarket prices</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  See which retailer has the cheapest basket
                </p>
              </div>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Compare →
              </span>
            </button>
          )}

          {baskets.length === 0 && !comparingPrices && !capabilitiesLoading && !livePricingAvailable && (
            <div className="glass-card flex items-center gap-3 p-4 text-left">
              <div className="icon-container shrink-0 bg-muted"><BarChart2 className="h-4 w-4 text-muted-foreground" /></div>
              <div>
                <p className="text-sm font-bold">Live price comparison is not connected</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Your shopping list and local estimates still work normally.</p>
              </div>
            </div>
          )}

          {comparingPrices && (
            <div className="glass-card p-4 flex items-center gap-3 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span className="text-sm">Checking prices across supermarkets…</span>
            </div>
          )}

          {compareError && !comparingPrices && (
            <div className="glass-card p-4 text-xs text-muted-foreground">
              {compareError} —{' '}
              <button className="underline" onClick={() => compare(unchecked.map(i => ({ name: i.name, quantity: i.quantity })))}>
                retry
              </button>
            </div>
          )}

          {baskets.length > 0 && (() => {
            const comparable = baskets.filter(b => b.total_is_comparable && b.items.length > 0);
            const incomplete = baskets.filter(b => !b.total_is_comparable && b.items.length > 0);
            const unavailable = baskets.filter(b => b.items.length === 0);
            return (
            <div className="glass-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/40 flex items-center justify-between">
                <h3 className="text-base font-bold">Price Comparison</h3>
                <button
                  onClick={clearCompare}
                  className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="divide-y divide-border/30">
                {comparable.map((basket, idx) => (
                  <div key={basket.retailer} className="flex items-center gap-3 px-5 py-3.5">
                    <span className={`w-14 shrink-0 text-[10px] font-bold uppercase tracking-wider ${idx === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                      {idx === 0 ? 'Cheapest' : `+£${(basket.total - comparable[0].total).toFixed(2)}`}
                    </span>
                    <span className="flex-1 text-sm font-semibold">{basket.retailer_name}</span>
                    {basket.not_found.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {basket.not_found.length} missing
                      </span>
                    )}
                    <span className="text-sm font-extrabold tabular-nums font-display">
                      £{basket.total.toFixed(2)}
                    </span>
                  </div>
                ))}
                {incomplete.map(basket => (
                  <div key={basket.retailer} className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Partial
                      </span>
                      <span className="flex-1 text-sm font-semibold">{basket.retailer_name}</span>
                      <span className="text-sm font-extrabold tabular-nums font-display">
                        £{basket.total.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-1 pl-[4.25rem] text-[10px] text-muted-foreground">
                      Subtotal only · {basket.matched_count} of {basket.requested_count} items matched
                    </p>
                  </div>
                ))}
                {unavailable.length > 0 && (
                  <div className="px-5 py-2.5 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      No results from: {unavailable.map(b => b.retailer_name).join(', ')}
                    </span>
                  </div>
                )}
              </div>
              <div className="px-5 py-2 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground">
                  {comparable.length > 0
                    ? `${comparable.length} complete basket${comparable.length === 1 ? '' : 's'} compared · live prices`
                    : 'No complete basket is available yet · partial subtotals are not ranked'}
                </p>
              </div>
            </div>
            );
          })()}
        </div>
      )}

      {/* Floating print button */}
      <button
        onClick={handlePrint}
        className="fixed bottom-24 md:bottom-8 right-6 z-40 bg-primary text-primary-foreground px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wider hover:shadow-xl transition-shadow print:hidden"
      >
        <Printer className="w-4 h-4" /> Print List
      </button>

      {/* Quick Add dialog */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Add Items</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">
            Type or paste a list — one item per line. Add quantities like <span className="font-mono bg-muted px-1 rounded">2x Milk</span> or <span className="font-mono bg-muted px-1 rounded">Eggs 6</span>.
          </p>
          <Textarea
            autoFocus
            placeholder={"Milk\n2x Bread\nCheddar cheese\nChicken breast 500g"}
            value={quickAddText}
            onChange={e => setQuickAddText(e.target.value)}
            className="min-h-[160px] font-mono text-sm resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleQuickAdd();
            }}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setQuickAddOpen(false); setQuickAddText(''); }}>
              Cancel
            </Button>
            <Button
              onClick={handleQuickAdd}
              disabled={!quickAddText.trim() || quickAddLoading}
              style={{ background: 'var(--gradient-primary)' }}
            >
              {quickAddLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Items grouped by aisle */}
      <div className="max-w-xl space-y-6">
        {grouped.map(([category, catItems]) => {
          const aisleTotal = catItems.reduce((sum, it) => {
            const p = prices.get(it.name);
            const qty = parseFloat(it.quantity) || 1;
            return sum + (p ? p * qty : 0);
          }, 0);
          return (
          <div key={category} className="glass-card overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-border/40">
              <h3 className="text-base font-bold">{category}</h3>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {catItems.length} Items{aisleTotal > 0 ? ` · £${aisleTotal.toFixed(2)}` : ''}
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {catItems.map(item => {
                const price = prices.get(item.name);
                const cheaper = getCheaperAlternative(item.name);
                return (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-low/50 transition-colors">
                  <Checkbox
                    aria-label={`Mark ${item.name} bought`}
                    checked={item.checked}
                    disabled={busyAction === item.id}
                    onCheckedChange={() => void toggleCheck(item)}
                    className="rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{item.name}</span>
                      {item.quantity !== '1' && (
                        <span className="text-xs text-muted-foreground">({item.quantity})</span>
                      )}
                    </div>
                    {cheaper && (
                      <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                        <Lightbulb className="w-3 h-3" />
                        <span>Try <span className="font-semibold text-foreground">{cheaper}</span> to save</span>
                      </div>
                    )}
                  </div>
                  {price !== undefined && (
                    <span className="text-sm font-bold tabular-nums">
                      £{(price * (parseFloat(item.quantity) || 1)).toFixed(2)}
                    </span>
                  )}
                  <Button aria-label={`Remove ${item.name}`} disabled={busyAction === item.id} variant="ghost" size="icon" className="h-11 w-11 rounded-xl opacity-60 hover:opacity-100 hover:bg-destructive/10" onClick={() => void remove(item.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              );})}
            </div>
          </div>
        );})}

        {/* Checked items */}
        {checked.length > 0 && (
          <div className="glass-card overflow-hidden opacity-60">
            <div className="px-5 py-3 border-b border-border/40">
              <h3 className="text-base font-bold">Done</h3>
            </div>
            <div className="divide-y divide-border/30">
              {checked.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Checkbox aria-label={`Mark ${item.name} not bought`} checked={true} disabled={busyAction === item.id} onCheckedChange={() => void toggleCheck(item)} className="rounded-lg" />
                  <span className="text-sm line-through flex-1 text-muted-foreground">{item.name}</span>
                  <Button aria-label={`Remove ${item.name}`} disabled={busyAction === item.id} variant="ghost" size="icon" className="h-11 w-11 rounded-xl hover:bg-destructive/10" onClick={() => void remove(item.id)}>
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

      <ReceiptReconcileDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        shoppingItems={items}
        onReconciled={load}
      />
    </div>
  );
}
