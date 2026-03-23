import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Refrigerator, Snowflake, Archive, Plus, ScanLine, ChefHat, ShoppingCart, ArrowRight } from 'lucide-react';
import { StorageLocation } from '@/types';
import ExpiryBanner from '@/components/ExpiryBanner';

const LOCATION_CONFIG: Record<StorageLocation, { label: string; icon: React.ReactNode; gradient: string }> = {
  fridge: { label: 'Fridge', icon: <Refrigerator className="w-6 h-6" />, gradient: 'from-blue-500/10 to-blue-600/5' },
  freezer: { label: 'Freezer', icon: <Snowflake className="w-6 h-6" />, gradient: 'from-cyan-500/10 to-cyan-600/5' },
  cupboard: { label: 'Cupboard', icon: <Archive className="w-6 h-6" />, gradient: 'from-amber-500/10 to-amber-600/5' },
};

const LOCATION_ICON_COLOR: Record<StorageLocation, string> = {
  fridge: 'text-blue-500',
  freezer: 'text-cyan-500',
  cupboard: 'text-amber-600',
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
      {/* Hero greeting */}
      <div className="pt-2">
        <h1 className="text-3xl font-bold tracking-tight">{greeting}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {inventory.length} item{inventory.length !== 1 ? 's' : ''} tracked across your kitchen
        </p>
      </div>

      {/* Expiry Alert */}
      <ExpiryBanner />

      {/* Storage summary */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(counts) as StorageLocation[]).map(loc => (
          <button
            key={loc}
            onClick={() => navigate('/inventory')}
            className={`glass-card bg-gradient-to-br ${LOCATION_CONFIG[loc].gradient} rounded-2xl p-4 text-center group active:scale-[0.97] transition-all`}
          >
            <div className={`mx-auto mb-2 ${LOCATION_ICON_COLOR[loc]} transition-transform group-hover:scale-110`}>
              {LOCATION_CONFIG[loc].icon}
            </div>
            <div className="text-2xl font-bold tabular-nums">{counts[loc]}</div>
            <div className="text-xs text-muted-foreground font-medium">{LOCATION_CONFIG[loc].label}</div>
          </button>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="section-title px-1">Quick Actions</h2>

        {/* Primary CTA */}
        <button
          onClick={() => navigate('/meals')}
          className="w-full glass-card bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 flex items-center gap-4 group active:scale-[0.98] transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-105">
            <ChefHat className="w-5 h-5" />
          </div>
          <div className="flex-1 text-left">
            <div className="font-semibold text-sm">What Can I Make?</div>
            <div className="text-xs text-muted-foreground">Meals from what you have</div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Secondary actions */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: ScanLine, label: 'Scan', sub: 'Receipt', onClick: () => navigate('/add-food') },
            { icon: Plus, label: 'Add', sub: 'Item', onClick: () => navigate('/add-food?mode=manual') },
            { icon: ShoppingCart, label: 'Shop', sub: 'List', onClick: () => navigate('/shopping') },
          ].map(({ icon: Icon, label, sub, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="glass-card p-3 flex flex-col items-center gap-1.5 group active:scale-[0.96] transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover:scale-105">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold">{label}</div>
                <div className="text-[10px] text-muted-foreground leading-tight">{sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
