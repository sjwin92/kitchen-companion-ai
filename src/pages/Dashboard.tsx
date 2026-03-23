import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Refrigerator,
  Snowflake,
  Archive,
  AlertTriangle,
  Plus,
  ScanLine,
  ChefHat,
  ListChecks,
  Settings as SettingsIcon,
  ShoppingCart
} from 'lucide-react';
import { StorageLocation } from '@/types';

const LOCATION_CONFIG: Record<StorageLocation, { label: string; icon: React.ReactNode; color: string }> = {
  fridge: { label: 'Fridge', icon: <Refrigerator className="w-5 h-5" />, color: 'text-blue-500' },
  freezer: { label: 'Freezer', icon: <Snowflake className="w-5 h-5" />, color: 'text-cyan-500' },
  cupboard: { label: 'Cupboard', icon: <Archive className="w-5 h-5" />, color: 'text-amber-600' },
};

export default function Dashboard() {
  const { inventory } = useApp();
  const activeInventory = inventory.filter(item => item.status !== 'used');
  const navigate = useNavigate();

  const counts: Record<StorageLocation, number> = { fridge: 0, freezer: 0, cupboard: 0 };
  activeInventory.forEach(item => counts[item.location]++);

  const useSoonItems = activeInventory.filter(i => i.status === 'use-today' || i.status === 'use-soon');

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Your Kitchen</h1>
          <p className="text-muted-foreground text-sm">{activeInventory.length} items tracked</p>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/settings')}
          aria-label="Open settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(counts) as StorageLocation[]).map(loc => (
          <button
            key={loc}
            onClick={() => navigate('/inventory')}
            className="bg-card rounded-xl p-4 border border-border hover:border-primary/30 transition-colors text-center"
          >
            <div className={`mx-auto mb-2 ${LOCATION_CONFIG[loc].color}`}>{LOCATION_CONFIG[loc].icon}</div>
            <div className="text-2xl font-bold">{counts[loc]}</div>
            <div className="text-xs text-muted-foreground">{LOCATION_CONFIG[loc].label}</div>
          </button>
        ))}
      </div>

      {useSoonItems.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h2 className="font-semibold text-sm">Use Soon</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/use-soon')} className="text-xs text-primary">
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {useSoonItems.slice(0, 4).map(item => (
              <div key={item.id} className="flex items-center justify-between py-1.5">
                <div>
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{item.quantity}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${item.status === 'use-today' ? 'status-urgent' : 'status-soon'}`}>
                  {item.status === 'use-today' ? 'Today' : 'Soon'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-2">
          <Button onClick={() => navigate('/add-food')} variant="outline" className="justify-start gap-3 h-12">
            <ScanLine className="w-5 h-5 text-primary" /> Scan Receipt
          </Button>
          <Button onClick={() => navigate('/add-food?mode=manual')} variant="outline" className="justify-start gap-3 h-12">
            <Plus className="w-5 h-5 text-primary" /> Add Item Manually
          </Button>
          <Button onClick={() => navigate('/meals')} className="justify-start gap-3 h-12">
            <ChefHat className="w-5 h-5" /> What Can I Make?
          </Button>
          <Button onClick={() => navigate('/shopping')} variant="outline" className="justify-start gap-3 h-12">
            <ShoppingCart className="w-5 h-5 text-primary" /> Shopping
          </Button>
          <Button onClick={() => navigate('/saved-lists')} variant="outline" className="justify-start gap-3 h-12">
            <ListChecks className="w-5 h-5 text-primary" /> Saved Shopping Lists
          </Button>
          <Button onClick={() => navigate('/settings')} variant="outline" className="justify-start gap-3 h-12">
            <SettingsIcon className="w-5 h-5 text-primary" /> Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
