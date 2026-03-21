import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Refrigerator, Snowflake, Archive, Plus, ScanLine, ChefHat, ShoppingCart } from 'lucide-react';
import { StorageLocation } from '@/types';
import ExpiryBanner from '@/components/ExpiryBanner';

const LOCATION_CONFIG: Record<StorageLocation, { label: string; icon: React.ReactNode; color: string }> = {
  fridge: { label: 'Fridge', icon: <Refrigerator className="w-5 h-5" />, color: 'text-blue-500' },
  freezer: { label: 'Freezer', icon: <Snowflake className="w-5 h-5" />, color: 'text-cyan-500' },
  cupboard: { label: 'Cupboard', icon: <Archive className="w-5 h-5" />, color: 'text-amber-600' },
};

export default function Dashboard() {
  const { inventory, preferences } = useApp();
  const navigate = useNavigate();

  const greeting = preferences.displayName
    ? `Hi, ${preferences.displayName} 👋`
    : 'Your Kitchen';

  const counts: Record<StorageLocation, number> = { fridge: 0, freezer: 0, cupboard: 0 };
  inventory.forEach(item => counts[item.location]++);

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{greeting}</h1>
        <p className="text-muted-foreground text-sm">{inventory.length} items tracked</p>
      </div>

      {/* Expiry Alert */}
      <ExpiryBanner />

      {/* Storage summary */}
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

      {/* Quick Actions */}
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
            <ShoppingCart className="w-5 h-5 text-primary" /> Shopping List
          </Button>
        </div>
      </div>
    </div>
  );
}
