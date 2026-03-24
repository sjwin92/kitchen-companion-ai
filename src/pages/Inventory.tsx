import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { StorageLocation, FoodItem } from '@/types';
import { Refrigerator, Snowflake, Archive, Pencil, Trash2, Check, PackageOpen, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import WasteDialog from '@/components/WasteDialog';

const TABS: { key: StorageLocation; label: string; icon: React.ReactNode; bg: string; iconColor: string }[] = [
  { key: 'fridge', label: 'Fridge', icon: <Refrigerator className="w-4 h-4" />, bg: 'bg-blue-50 dark:bg-blue-950/40', iconColor: 'text-blue-500' },
  { key: 'freezer', label: 'Freezer', icon: <Snowflake className="w-4 h-4" />, bg: 'bg-cyan-50 dark:bg-cyan-950/40', iconColor: 'text-cyan-500' },
  { key: 'cupboard', label: 'Cupboard', icon: <Archive className="w-4 h-4" />, bg: 'bg-amber-50 dark:bg-amber-950/40', iconColor: 'text-amber-600' },
];

const LOCATION_BUTTONS: { value: StorageLocation; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
  { value: 'fridge', label: 'Fridge', icon: <Refrigerator className="w-4 h-4" />, color: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40', activeColor: 'bg-emerald-500 text-white border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600' },
  { value: 'freezer', label: 'Freezer', icon: <Snowflake className="w-4 h-4" />, color: 'border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/40', activeColor: 'bg-blue-500 text-white border-blue-500 dark:bg-blue-600 dark:border-blue-600' },
  { value: 'cupboard', label: 'Cupboard', icon: <Archive className="w-4 h-4" />, color: 'border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/40', activeColor: 'bg-amber-500 text-white border-amber-500 dark:bg-amber-600 dark:border-amber-600' },
];

export default function Inventory() {
  const { inventory, removeItem, updateItem } = useApp();
  const [tab, setTab] = useState<StorageLocation>('fridge');
  const [editItem, setEditItem] = useState<FoodItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editLocation, setEditLocation] = useState<StorageLocation>('fridge');
  const [editExpiryDate, setEditExpiryDate] = useState<Date | undefined>(undefined);
  const [wasteItem, setWasteItem] = useState<FoodItem | null>(null);

  const items = inventory.filter(i => i.location === tab);
  const currentTab = TABS.find(t => t.key === tab)!;

  const openEdit = (item: FoodItem) => {
    setEditItem(item);
    setEditName(item.name);
    setEditQty(item.quantity);
    setEditLocation(item.location);
    if (item.expiryDate) {
      setEditExpiryDate(new Date(item.expiryDate));
    } else {
      const estimated = new Date();
      estimated.setDate(estimated.getDate() + item.daysUntilExpiry);
      setEditExpiryDate(estimated);
    }
  };

  const saveEdit = () => {
    if (editItem) {
      const updates: Partial<FoodItem> = { name: editName, quantity: editQty, location: editLocation };
      if (editExpiryDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiry = new Date(editExpiryDate);
        expiry.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        updates.daysUntilExpiry = Math.max(0, diffDays);
        updates.expiryDate = expiry.toISOString().split('T')[0];
        updates.status = diffDays <= 1 ? 'use-today' : diffDays <= 3 ? 'use-soon' : 'okay';
      }
      updateItem(editItem.id, updates);
      setEditItem(null);
    }
  };

  const statusBadge = (item: FoodItem) => {
    if (item.status === 'use-today') return <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold status-urgent">Today</span>;
    if (item.status === 'use-soon') return <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold status-soon">Soon</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full border font-semibold status-okay">Good</span>;
  };

  const formatExpiry = (item: FoodItem) => {
    if (item.expiryDate) {
      return `Exp ${new Date(item.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    }
    return `~${item.daysUntilExpiry}d left`;
  };

  return (
    <div className="p-4 pb-28 max-w-lg mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">{items.length} items in {currentTab.label.toLowerCase()}</p>
      </div>

      {/* Tabs */}
      <div className="glass-card p-1.5 flex gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              tab === t.key
                ? 'bg-card shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={tab === t.key ? t.iconColor : ''}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="icon-container mx-auto mb-3 bg-muted">
            <PackageOpen className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Nothing in your {tab} yet</p>
          <p className="text-xs mt-1">Add items by scanning a receipt or manually</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="glass-card p-3.5 flex items-center justify-between animate-fade-in"
              style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{item.name}</span>
                  {statusBadge(item)}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <span className="font-medium">{item.quantity}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{formatExpiry(item)}</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 ml-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-muted" onClick={() => openEdit(item)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-success/10" onClick={() => removeItem(item.id)}>
                  <Check className="w-3.5 h-3.5 text-success" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-destructive/10" onClick={() => setWasteItem(item)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Quantity</label>
                <Input value={editQty} onChange={e => setEditQty(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Location</label>
              <div className="flex gap-2">
                {LOCATION_BUTTONS.map(loc => (
                  <button
                    key={loc.value}
                    onClick={() => setEditLocation(loc.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                      editLocation === loc.value ? loc.activeColor : loc.color
                    }`}
                  >
                    {loc.icon}
                    {loc.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Expiry Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editExpiryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {editExpiryDate ? format(editExpiryDate, "PPP") : <span>Set expiry date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editExpiryDate}
                    onSelect={setEditExpiryDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {editExpiryDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const exp = new Date(editExpiryDate);
                    exp.setHours(0, 0, 0, 0);
                    const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} ago`;
                    if (days === 0) return 'Expires today';
                    return `${days} day${days > 1 ? 's' : ''} remaining`;
                  })()}
                </p>
              )}
            </div>
            <Button onClick={saveEdit} className="w-full" style={{ background: 'var(--gradient-primary)' }}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Waste Dialog */}
      <WasteDialog item={wasteItem} open={!!wasteItem} onClose={() => setWasteItem(null)} />
    </div>
  );
}
