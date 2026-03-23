import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { StorageLocation, FoodItem } from '@/types';
import { Refrigerator, Snowflake, Archive, Pencil, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import WasteDialog from '@/components/WasteDialog';

const TABS: { key: StorageLocation; label: string; icon: React.ReactNode }[] = [
  { key: 'fridge', label: 'Fridge', icon: <Refrigerator className="w-4 h-4" /> },
  { key: 'freezer', label: 'Freezer', icon: <Snowflake className="w-4 h-4" /> },
  { key: 'cupboard', label: 'Cupboard', icon: <Archive className="w-4 h-4" /> },
];

export default function Inventory() {
  const { inventory, removeItem, updateItem } = useApp();
  const [tab, setTab] = useState<StorageLocation>('fridge');
  const [editItem, setEditItem] = useState<FoodItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editLocation, setEditLocation] = useState<StorageLocation>('fridge');
  const [wasteItem, setWasteItem] = useState<FoodItem | null>(null);

  const items = inventory.filter(i => i.location === tab);

  const openEdit = (item: FoodItem) => {
    setEditItem(item);
    setEditName(item.name);
    setEditQty(item.quantity);
    setEditLocation(item.location);
  };

  const saveEdit = () => {
    if (editItem) {
      updateItem(editItem.id, { name: editName, quantity: editQty, location: editLocation });
      setEditItem(null);
    }
  };

  const statusBadge = (item: FoodItem) => {
    if (item.status === 'use-today') return <span className="text-xs px-2 py-0.5 rounded-full border status-urgent">Today</span>;
    if (item.status === 'use-soon') return <span className="text-xs px-2 py-0.5 rounded-full border status-soon">Soon</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full border status-okay">Good</span>;
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/60 backdrop-blur-sm p-1 rounded-2xl">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nothing in your {tab} yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="glass-card p-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{item.name}</span>
                  {statusBadge(item)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {item.quantity} · Added {new Date(item.dateAdded).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(item.id)}>
                  <Check className="w-3.5 h-3.5 text-success" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setWasteItem(item)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input value={editQty} onChange={e => setEditQty(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Location</label>
              <Select value={editLocation} onValueChange={v => setEditLocation(v as StorageLocation)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fridge">Fridge</SelectItem>
                  <SelectItem value="freezer">Freezer</SelectItem>
                  <SelectItem value="cupboard">Cupboard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveEdit} className="w-full">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Waste Dialog */}
      <WasteDialog item={wasteItem} open={!!wasteItem} onClose={() => setWasteItem(null)} />
    </div>
  );
}
