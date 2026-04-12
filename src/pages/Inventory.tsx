import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { StorageLocation, FoodItem } from '@/types';
import { Refrigerator, Snowflake, Archive, Pencil, Trash2, Check, PackageOpen, CalendarDays, Lightbulb, MoreHorizontal, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import WasteDialog from '@/components/WasteDialog';
import { useNavigate } from 'react-router-dom';

const TABS: { key: StorageLocation; label: string; icon: React.ReactNode }[] = [
  { key: 'fridge', label: 'Fridge', icon: <Refrigerator className="w-4 h-4" /> },
  { key: 'freezer', label: 'Freezer', icon: <Snowflake className="w-4 h-4" /> },
  { key: 'cupboard', label: 'Cupboard', icon: <Archive className="w-4 h-4" /> },
];

const LOCATION_BUTTONS: { value: StorageLocation; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
  { value: 'fridge', label: 'Fridge', icon: <Refrigerator className="w-4 h-4" />, color: 'border-border text-foreground hover:bg-muted', activeColor: 'bg-primary text-primary-foreground border-primary' },
  { value: 'freezer', label: 'Freezer', icon: <Snowflake className="w-4 h-4" />, color: 'border-border text-foreground hover:bg-muted', activeColor: 'bg-primary text-primary-foreground border-primary' },
  { value: 'cupboard', label: 'Cupboard', icon: <Archive className="w-4 h-4" />, color: 'border-border text-foreground hover:bg-muted', activeColor: 'bg-primary text-primary-foreground border-primary' },
];

// Categorize items
function categorize(name: string): string {
  const n = name.toLowerCase();
  const dairy = ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'ricotta', 'mozzarella', 'parmesan', 'pecorino', 'egg'];
  const veg = ['tomato', 'onion', 'garlic', 'pepper', 'carrot', 'potato', 'spinach', 'kale', 'lettuce', 'zucchini', 'broccoli', 'mushroom', 'celery', 'cucumber', 'avocado', 'corn', 'pea', 'bean', 'lentil'];
  const fruit = ['apple', 'banana', 'orange', 'lemon', 'lime', 'berry', 'grape', 'mango', 'pear', 'peach', 'strawberry', 'blueberry'];
  const meat = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'steak', 'salmon', 'fish', 'shrimp', 'prawn'];
  if (dairy.some(d => n.includes(d))) return 'Dairy';
  if (veg.some(v => n.includes(v))) return 'Vegetables';
  if (fruit.some(f => n.includes(f))) return 'Fruit';
  if (meat.some(m => n.includes(m))) return 'Protein';
  return 'Pantry';
}

export default function Inventory() {
  const { inventory, removeItem, updateItem } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<StorageLocation>('fridge');
  const [editItem, setEditItem] = useState<FoodItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editLocation, setEditLocation] = useState<StorageLocation>('fridge');
  const [editExpiryDate, setEditExpiryDate] = useState<Date | undefined>(undefined);
  const [wasteItem, setWasteItem] = useState<FoodItem | null>(null);

  const items = inventory.filter(i => i.location === tab);
  const currentTab = TABS.find(t => t.key === tab)!;

  // Smart suggestion based on expiring items
  const expiringSoon = inventory.filter(i => i.status === 'use-today' || i.status === 'use-soon');
  const suggestion = expiringSoon.length > 0
    ? `Your ${expiringSoon.slice(0, 2).map(i => i.name).join(' and ')} ${expiringSoon.length > 2 ? `and ${expiringSoon.length - 2} more` : ''} ${expiringSoon.length === 1 ? 'is' : 'are'} expiring soon. Consider making a ${expiringSoon[0]?.name} recipe tonight.`
    : null;

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
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const expiry = new Date(editExpiryDate); expiry.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        updates.daysUntilExpiry = Math.max(0, diffDays);
        updates.expiryDate = expiry.toISOString().split('T')[0];
        updates.status = diffDays <= 1 ? 'use-today' : diffDays <= 3 ? 'use-soon' : 'okay';
      }
      updateItem(editItem.id, updates);
      setEditItem(null);
    }
  };

  const statusLabel = (item: FoodItem) => {
    if (item.status === 'use-today') return 'EXPIRING SOON';
    if (item.status === 'use-soon') return 'EXPIRING SOON';
    return 'FRESH';
  };

  const statusClass = (item: FoodItem) => {
    if (item.status === 'use-today' || item.status === 'use-soon') return 'text-destructive';
    return 'text-primary';
  };

  return (
    <div className="p-4 md:px-8 md:py-10 pb-28 md:pb-8 max-w-7xl mx-auto animate-fade-in">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
        {/* Main content */}
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-display">Inventory</h1>
              <p className="text-sm text-muted-foreground mt-1">{items.length} items in {currentTab.label.toLowerCase()}</p>
            </div>
            <Button
              onClick={() => navigate('/add-food')}
              size="sm"
              className="rounded-xl text-xs gap-1.5 hidden md:flex"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Item
            </Button>
          </div>

          {/* Tabs — clean underline style */}
          <div className="flex gap-1 border-b border-border/40 mb-6">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                  tab === t.key
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Items list — editorial row style */}
          {items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="icon-container mx-auto mb-3 bg-muted">
                <PackageOpen className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Nothing in your {tab} yet</p>
              <p className="text-xs mt-1">Add items by scanning a receipt or manually</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 py-4 animate-fade-in group"
                  style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }}
                >
                  {/* Food image placeholder */}
                  <div className="w-12 h-12 rounded-lg bg-surface-high flex items-center justify-center shrink-0 overflow-hidden">
                    <span className="text-lg">🥘</span>
                  </div>

                  {/* Name & category */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      {categorize(item.name)}
                    </p>
                  </div>

                  {/* Quantity */}
                  <span className="text-sm text-muted-foreground font-medium shrink-0 w-20 text-right">
                    {item.quantity}
                  </span>

                  {/* Status */}
                  <span className={`text-[10px] font-bold uppercase tracking-[0.12em] shrink-0 w-28 text-right ${statusClass(item)}`}>
                    {statusLabel(item)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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

                  {/* Mobile: three-dot menu */}
                  <div className="md:hidden flex items-center">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => openEdit(item)}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5 hidden md:block">
          {/* Smart Suggestion */}
          {suggestion && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-primary" />
                <h3 className="section-title">Smart Suggestion</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                "{suggestion}"
              </p>
            </div>
          )}

          {/* Location summary */}
          <div className="glass-card p-5">
            <h3 className="section-title mb-4">Storage Overview</h3>
            <div className="space-y-4">
              {TABS.map(t => {
                const count = inventory.filter(i => i.location === t.key).length;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`w-full flex items-center justify-between py-2 text-left transition-colors ${tab === t.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      {t.icon}
                      <span className="text-sm font-medium">{t.label}</span>
                    </div>
                    <span className="text-sm font-bold">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

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
                    {loc.icon} {loc.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Expiry Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editExpiryDate && "text-muted-foreground")}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {editExpiryDate ? format(editExpiryDate, "PPP") : <span>Set expiry date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={editExpiryDate} onSelect={setEditExpiryDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              {editExpiryDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(() => {
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const exp = new Date(editExpiryDate); exp.setHours(0, 0, 0, 0);
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

      <WasteDialog item={wasteItem} open={!!wasteItem} onClose={() => setWasteItem(null)} />
    </div>
  );
}
