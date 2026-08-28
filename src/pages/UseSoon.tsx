import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import type { FoodItem } from '@/types';
import { AlertTriangle, Clock, CheckCircle2, MoreHorizontal, Search, CalendarPlus, Check, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import WasteDialog from '@/components/WasteDialog';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/appError';

export default function UseSoon() {
  const { inventory, inventoryError, removeItem, transitionItem, refreshInventory } = useApp();
  const navigate = useNavigate();
  const [wasteItem, setWasteItem] = useState<FoodItem | null>(null);

  const useToday = inventory.filter(i => i.status === 'use-today');
  const useSoon = inventory.filter(i => i.status === 'use-soon');
  const okay = inventory.filter(i => i.status === 'okay');

  const markUsed = async (item: FoodItem) => {
    try {
      await removeItem(item.id);
      toast.success(`${item.name} marked as used`, {
        action: {
          label: 'Undo',
          onClick: () => void transitionItem(item.id, 'available', 'Undo consumed action')
            .then(() => toast.success(`${item.name} restored`))
            .catch(error => toast.error(errorMessage(error, 'Could not restore this item.'))),
        },
      });
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update this item.'));
    }
  };

  const Section = ({ title, icon, items, variant }: { title: string; icon: React.ReactNode; items: FoodItem[]; variant: string }) => (
    items.length > 0 ? (
      <section className="space-y-2" aria-labelledby={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}>
        <div className="flex items-center gap-2">
          {icon}
          <h2 id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`} className="text-sm font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <div className="overflow-hidden rounded-[1.35rem] border border-border/60 bg-card shadow-[var(--shadow-card)]">
          {items.map(item => (
            <div key={item.id} className="flex min-w-0 items-center gap-3 border-b border-border/50 p-4 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.quantity} · {item.location}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${variant}`}>
                {item.daysUntilExpiry <= 1 ? 'Today' : `${item.daysUntilExpiry}d`}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl" aria-label={`Actions for ${item.name}`}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52 rounded-xl p-1.5">
                  <DropdownMenuItem className="min-h-11 gap-2 rounded-lg" onSelect={() => navigate(`/meals?search=${encodeURIComponent(item.name)}`)}><Search className="h-4 w-4" /> Find recipes</DropdownMenuItem>
                  <DropdownMenuItem className="min-h-11 gap-2 rounded-lg" onSelect={() => navigate('/meal-planner')}><CalendarPlus className="h-4 w-4" /> Plan a meal</DropdownMenuItem>
                  <DropdownMenuItem className="min-h-11 gap-2 rounded-lg" onSelect={() => void markUsed(item)}><Check className="h-4 w-4 text-success" /> Mark used</DropdownMenuItem>
                  <DropdownMenuItem className="min-h-11 gap-2 rounded-lg text-destructive" onSelect={() => setWasteItem(item)}><Trash2 className="h-4 w-4" /> Log as waste</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </section>
    ) : null
  );

  return (
    <main className="mx-auto max-w-2xl space-y-7 px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-10">
      <header>
        <p className="section-title mb-2">Freshness queue</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Use Soon</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose what to rescue, plan, use or record as waste.</p>
      </header>

      {inventoryError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <span>{inventoryError}</span>
          <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => void refreshInventory().catch(error => toast.error(errorMessage(error, 'Could not refresh inventory.')))}>Retry</Button>
        </div>
      )}

      <Section title="Use Today" icon={<AlertTriangle className="h-4 w-4 text-destructive" />} items={useToday} variant="status-urgent" />
      <Section title="Use Soon" icon={<Clock className="h-4 w-4 text-warning" />} items={useSoon} variant="status-soon" />
      <Section title="Okay for Later" icon={<CheckCircle2 className="h-4 w-4 text-success" />} items={okay} variant="status-okay" />

      {inventory.length === 0 && (
        <section className="rounded-[1.75rem] border border-border/60 bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e9e4da]"><CheckCircle2 className="h-5 w-5 text-primary" /></div>
          <h2 className="mt-4 text-lg font-semibold">Nothing to rescue yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Add food with an expiry date and Kitchen Companion will prioritise it here.</p>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button className="min-h-11 rounded-xl" onClick={() => navigate('/add-food')}><Plus className="mr-2 h-4 w-4" /> Add food</Button>
            <Button className="min-h-11 rounded-xl" variant="outline" onClick={() => navigate('/meals')}><Search className="mr-2 h-4 w-4" /> Browse recipes</Button>
          </div>
        </section>
      )}

      <WasteDialog item={wasteItem} open={!!wasteItem} onClose={() => setWasteItem(null)} />
    </main>
  );
}
