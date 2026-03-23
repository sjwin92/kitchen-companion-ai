import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Refrigerator,
  Snowflake,
  Archive,
  AlertTriangle,
  ScanLine,
  ChefHat,
  ShoppingCart,
  Sparkles,
  ArrowRight,
  Leaf,
  CalendarDays,
} from 'lucide-react';
import { StorageLocation } from '@/types';
import { useMealPlans, MEAL_SLOTS, type MealSlot } from '@/hooks/useMealPlans';

const LOCATION_CONFIG: Record<StorageLocation, { label: string; icon: React.ReactNode; bg: string; iconColor: string }> = {
  fridge: {
    label: 'Fridge',
    icon: <Refrigerator className="w-5 h-5" />,
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    iconColor: 'text-blue-500',
  },
  freezer: {
    label: 'Freezer',
    icon: <Snowflake className="w-5 h-5" />,
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    iconColor: 'text-cyan-500',
  },
  cupboard: {
    label: 'Cupboard',
    icon: <Archive className="w-5 h-5" />,
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    iconColor: 'text-amber-600',
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

  return (
    <div className="p-4 pb-28 max-w-lg mx-auto space-y-5 animate-fade-in">
      {/* Hero greeting */}
      <div className="pt-2">
        <div className="flex items-center gap-2 mb-1">
          <Leaf className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary uppercase tracking-wider">Kitchen Companion</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting}{displayName} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {activeInventory.length > 0
            ? `${activeInventory.length} items in your kitchen`
            : 'Start by adding items to your kitchen'}
        </p>
      </div>

      {/* Storage cards */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(counts) as StorageLocation[]).map((loc, i) => (
          <button
            key={loc}
            onClick={() => navigate('/inventory')}
            className="glass-card p-4 text-center group animate-fade-in"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}
          >
            <div className={`icon-container mx-auto mb-2.5 ${LOCATION_CONFIG[loc].bg} ${LOCATION_CONFIG[loc].iconColor}`}>
              {LOCATION_CONFIG[loc].icon}
            </div>
            <div className="text-2xl font-bold tracking-tight">{counts[loc]}</div>
            <div className="text-[11px] text-muted-foreground font-medium mt-0.5">{LOCATION_CONFIG[loc].label}</div>
          </button>
        ))}
      </div>

      {/* Use Soon alert */}
      {useSoonItems.length > 0 && (
        <button
          onClick={() => navigate('/use-soon')}
          className="glass-card w-full p-4 text-left animate-fade-in"
          style={{ animationDelay: '240ms', animationFillMode: 'backwards' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="icon-container bg-warning/10">
                <AlertTriangle className="w-4 h-4 text-warning" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">Use Soon</h2>
                <p className="text-xs text-muted-foreground">{useSoonItems.length} item{useSoonItems.length > 1 ? 's' : ''} need attention</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {useSoonItems.slice(0, 5).map(item => (
              <span
                key={item.id}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                  item.status === 'use-today' ? 'status-urgent' : 'status-soon'
                }`}
              >
                {item.name}
              </span>
            ))}
            {useSoonItems.length > 5 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                +{useSoonItems.length - 5} more
              </span>
            )}
          </div>
        </button>
      )}

      {/* Today's Meal Plan */}
      <button
        onClick={() => navigate('/meal-planner')}
        className="glass-card w-full p-4 text-left animate-fade-in"
        style={{ animationDelay: '280ms', animationFillMode: 'backwards' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="icon-container bg-violet-500/10 dark:bg-violet-500/20">
              <CalendarDays className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Today's Meals</h2>
              <p className="text-xs text-muted-foreground">
                {todayPlans.length > 0
                  ? `${todayPlans.length} meal${todayPlans.length > 1 ? 's' : ''} planned`
                  : 'No meals planned yet'}
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </div>
        {todayPlans.length > 0 ? (
          <div className="space-y-1.5">
            {MEAL_SLOTS.map(slot => {
              const plan = todayPlans.find(p => p.meal_slot === slot);
              if (!plan) return null;
              return (
                <div key={slot} className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="text-sm">{SLOT_EMOJI[slot]}</span>
                  {plan.image && (
                    <img src={plan.image} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{plan.title}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{slot}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Tap to plan your meals for the week</p>
        )}

      {/* Primary CTA */}
      <button
        onClick={() => navigate('/meals')}
        className="w-full rounded-2xl p-5 text-left text-primary-foreground relative overflow-hidden animate-fade-in group"
        style={{
          background: 'var(--gradient-primary)',
          boxShadow: 'var(--shadow-glow-primary)',
          animationDelay: '320ms',
          animationFillMode: 'backwards',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">What Can I Make?</h3>
              <p className="text-sm opacity-80">Find recipes with your ingredients</p>
            </div>
          </div>
          <Sparkles className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>

      {/* Quick actions grid */}
      <div className="space-y-3">
        <h2 className="section-title px-1">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Scan Receipt', icon: ScanLine, path: '/add-food', delay: 400 },
            { label: 'Shopping List', icon: ShoppingCart, path: '/shopping', delay: 480 },
          ].map(action => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="glass-card p-4 flex flex-col items-start gap-3 text-left animate-fade-in"
              style={{ animationDelay: `${action.delay}ms`, animationFillMode: 'backwards' }}
            >
              <div className="icon-container bg-primary/8 dark:bg-primary/15">
                <action.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold">{action.label}</span>
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
