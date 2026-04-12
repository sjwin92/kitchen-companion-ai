import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import FirstWinCard from '@/components/FirstWinCard';
import {
  Refrigerator,
  Snowflake,
  Package,
  AlertTriangle,
  ChefHat,
  ShoppingCart,
  ArrowRight,
  Leaf,
  CalendarDays,
  Camera,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { StorageLocation } from '@/types';
import { useMealPlans, MEAL_SLOTS, type MealSlot } from '@/hooks/useMealPlans';

const LOCATION_CONFIG: Record<StorageLocation, { label: string; icon: React.ReactNode; bg: string; iconColor: string }> = {
  fridge: {
    label: 'Fridge',
    icon: <Refrigerator className="w-5 h-5" />,
    bg: 'bg-primary/8 dark:bg-primary/15',
    iconColor: 'text-primary',
  },
  freezer: {
    label: 'Freezer',
    icon: <Snowflake className="w-5 h-5" />,
    bg: 'bg-primary/8 dark:bg-primary/15',
    iconColor: 'text-primary',
  },
  cupboard: {
    label: 'Cupboard',
    icon: <Package className="w-5 h-5" />,
    bg: 'bg-primary/8 dark:bg-primary/15',
    iconColor: 'text-primary',
  },
};

const SLOT_EMOJI: Record<MealSlot, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

export default function Dashboard() {
  const { inventory, preferences } = useApp();
  const activeInventory = inventory.filter(item => (item.status as string) !== 'used');
  const navigate = useNavigate();
  const { plans: todayPlans, loading: plansLoading } = useMealPlans();

  const counts: Record<StorageLocation, number> = { fridge: 0, freezer: 0, cupboard: 0 };
  activeInventory.forEach(item => counts[item.location]++);

  const useSoonItems = activeInventory.filter(i => i.status === 'use-today' || i.status === 'use-soon');
  const greeting = getGreeting();
  const displayName = preferences.displayName ? `, ${preferences.displayName.split(' ')[0]}` : '';

  const optimizationPercent = activeInventory.length > 0
    ? Math.round(((activeInventory.length - useSoonItems.length) / activeInventory.length) * 100)
    : 100;

  return (
    <div className="p-4 pb-28 max-w-lg mx-auto space-y-5 animate-fade-in">
      {/* Hero greeting */}
      <div className="pt-3 pb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
          Kitchen Companion
        </p>
        <h1 className="text-2xl font-bold tracking-tight leading-tight">
          {greeting}{displayName}.
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          {activeInventory.length > 0
            ? <>
                {useSoonItems.length > 0
                  ? <>{useSoonItems.length} ingredient{useSoonItems.length > 1 ? 's' : ''} need attention today. </>
                  : null}
                Your kitchen is {optimizationPercent}% optimized.
              </>
            : 'Start by adding items to your kitchen.'}
        </p>
      </div>

      {/* First-win activation */}
      <FirstWinCard />

      {/* Action Required */}
      {useSoonItems.length > 0 && (
        <div className="animate-fade-in" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Action Required</h2>
            <button onClick={() => navigate('/use-soon')} className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors">
              View All
            </button>
          </div>
          <div className="space-y-2">
            {useSoonItems.slice(0, 4).map((item, i) => (
              <button
                key={item.id}
                onClick={() => navigate('/use-soon')}
                className="glass-card w-full p-3.5 flex items-center gap-3.5 text-left animate-fade-in"
                style={{ animationDelay: `${120 + i * 60}ms`, animationFillMode: 'backwards' }}
              >
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center shrink-0">
                  <Leaf className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.status === 'use-today' ? 'Expiring today' : 'Expiring soon'}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                  item.status === 'use-today' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
                }`}>
                  {item.status === 'use-today' ? 'Critical' : 'High'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Status */}
      <div className="animate-fade-in" style={{ animationDelay: '160ms', animationFillMode: 'backwards' }}>
        <h2 className="section-title mb-3">Inventory Status</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {(Object.keys(counts) as StorageLocation[]).map((loc, i) => {
            const capacity = loc === 'fridge' ? 50 : loc === 'freezer' ? 30 : 100;
            const percent = Math.min(100, Math.round((counts[loc] / capacity) * 100));
            return (
              <button
                key={loc}
                onClick={() => navigate('/inventory')}
                className="glass-card p-3.5 text-left group animate-fade-in"
                style={{ animationDelay: `${200 + i * 60}ms`, animationFillMode: 'backwards' }}
              >
                <div className={`icon-container mb-2.5 ${LOCATION_CONFIG[loc].bg} ${LOCATION_CONFIG[loc].iconColor}`}>
                  {LOCATION_CONFIG[loc].icon}
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">{LOCATION_CONFIG[loc].label}</p>
                <p className="text-lg font-bold tracking-tight mt-0.5">{counts[loc]} <span className="text-[11px] font-medium text-muted-foreground">Items</span></p>
                {/* Mini progress bar */}
                <div className="mt-2 h-1 rounded-full bg-surface-high overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Today's Meal Plan */}
      <div className="animate-fade-in" style={{ animationDelay: '280ms', animationFillMode: 'backwards' }}>
        <h2 className="section-title mb-3">Today's Schedule</h2>
        <button
          onClick={() => navigate('/meal-planner')}
          className="glass-card w-full p-4 text-left"
        >
          {todayPlans.length > 0 ? (
            <div className="space-y-2">
              {MEAL_SLOTS.map(slot => {
                const plan = todayPlans.find(p => p.meal_slot === slot);
                if (!plan) return null;
                return (
                  <div key={slot} className="flex items-center gap-3 rounded-lg bg-surface-low px-3 py-2.5">
                    <span className="text-sm">{SLOT_EMOJI[slot]}</span>
                    {plan.image && (
                      <img src={plan.image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{plan.title}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{slot}</p>
                    </div>
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary/40" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="icon-container bg-primary/8">
                <CalendarDays className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">No meals planned</p>
                <p className="text-[11px] text-muted-foreground">Tap to plan your meals for the week</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </div>
          )}
        </button>
      </div>

      {/* Primary CTA */}
      <button
        onClick={() => navigate('/meals')}
        className="w-full rounded-xl p-5 text-left text-primary-foreground relative overflow-hidden animate-fade-in group"
        style={{
          background: 'var(--gradient-primary)',
          boxShadow: 'var(--shadow-glow-primary)',
          animationDelay: '340ms',
          animationFillMode: 'backwards',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">What Can I Make?</h3>
              <p className="text-xs opacity-75">Find recipes with your ingredients</p>
            </div>
          </div>
          <Sparkles className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>

      {/* Quick actions grid */}
      <div className="space-y-3">
        <h2 className="section-title">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: 'Log a Meal', icon: Camera, path: '/meal-log', delay: 380 },
            { label: 'Weekly Insights', icon: TrendingUp, path: '/weekly-insights', delay: 420 },
            { label: 'Scan Receipt', icon: Clock, path: '/add-food', delay: 460 },
            { label: 'Shopping List', icon: ShoppingCart, path: '/shopping-list', delay: 500 },
          ].map(action => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="glass-card p-3.5 flex flex-col items-start gap-2.5 text-left animate-fade-in"
              style={{ animationDelay: `${action.delay}ms`, animationFillMode: 'backwards' }}
            >
              <div className="icon-container bg-primary/8 dark:bg-primary/15">
                <action.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-bold">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
