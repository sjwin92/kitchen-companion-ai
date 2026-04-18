import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import FirstWinCard from '@/components/FirstWinCard';
import CalorieTracker from '@/components/CalorieTracker';
import TasteProfileCard from '@/components/TasteProfileCard';
import {
  Refrigerator,
  Snowflake,
  Package,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Zap,
  Leaf,
  CalendarDays,
  Camera,
  TrendingUp,
  ShoppingCart,
} from 'lucide-react';
import { StorageLocation } from '@/types';
import { useMealPlans, MEAL_SLOTS, type MealSlot } from '@/hooks/useMealPlans';

const LOCATION_ICONS: Record<StorageLocation, React.ReactNode> = {
  fridge: <Refrigerator className="w-5 h-5 text-primary" />,
  freezer: <Snowflake className="w-5 h-5 text-primary" />,
  cupboard: <Package className="w-5 h-5 text-primary" />,
};

const LOCATION_LABELS: Record<StorageLocation, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  cupboard: 'Pantry',
};

export default function Dashboard() {
  const { inventory, preferences } = useApp();
  const activeInventory = inventory.filter(item => (item.status as string) !== 'used');
  const navigate = useNavigate();
  const { plans: todayPlans } = useMealPlans();

  const counts: Record<StorageLocation, number> = { fridge: 0, freezer: 0, cupboard: 0 };
  activeInventory.forEach(item => counts[item.location]++);

  const useSoonItems = activeInventory.filter(i => i.status === 'use-today' || i.status === 'use-soon');
  const greeting = getGreeting();
  const displayName = preferences.displayName ? `, ${preferences.displayName.split(' ')[0]}` : '';

  const optimizationPercent = activeInventory.length > 0
    ? Math.round(((activeInventory.length - useSoonItems.length) / activeInventory.length) * 100)
    : 100;

  return (
    <div className="p-4 md:px-8 md:py-10 pb-28 md:pb-8 max-w-7xl mx-auto animate-fade-in">
      {/* Hero greeting — editorial style */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
        <div className="pt-2">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight font-display">
            {greeting}{displayName}.
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-md">
            {useSoonItems.length > 0 && (
              <>{useSoonItems.length} ingredient{useSoonItems.length > 1 ? 's' : ''} need attention today. </>
            )}
            Your kitchen is currently {optimizationPercent}% optimized.
          </p>
        </div>
        <button
          onClick={() => navigate('/waste')}
          className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-primary/8 text-primary text-[10px] font-bold tracking-[0.14em] uppercase hover:bg-primary/12 transition-colors shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          Today's Goal: Zero Waste
        </button>
      </div>

      {/* First-win activation */}
      <FirstWinCard />

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8 mt-6">
        {/* Left column */}
        <div className="space-y-8">
          {/* Use Soon */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold tracking-tight">Use Soon</h2>
              <button
                onClick={() => navigate('/use-soon')}
                className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground hover:text-primary transition-colors"
              >
                View All
              </button>
            </div>
            {useSoonItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {useSoonItems.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate('/use-soon')}
                    className="glass-card p-4 flex items-center gap-3.5 text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center shrink-0">
                      <Leaf className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.status === 'use-today' ? 'Expires today' : `${item.daysUntilExpiry} days remaining`}
                      </p>
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md whitespace-nowrap ${
                      item.status === 'use-today' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
                    }`}>
                      {item.status === 'use-today' ? 'High Priority' : 'Medium'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="glass-card p-6 text-center">
                <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No items need immediate attention. Great job!</p>
              </div>
            )}
          </section>

          {/* Featured Recommendation — large editorial card */}
          <button
            onClick={() => navigate('/meals')}
            className="w-full rounded-xl overflow-hidden text-left group"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] bg-card">
              <div className="aspect-[4/3] sm:aspect-auto bg-surface-high relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800"
                  alt="Fresh bowl"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-5 md:p-6 flex flex-col justify-center">
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-primary mb-2">
                  Recommendation
                </p>
                <h3 className="text-xl md:text-2xl font-bold tracking-tight leading-tight mb-2">
                  What Can I Make?
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Find recipes that use your ingredients. Prioritize expiring items to reduce waste.
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                  Start Cooking <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </button>

          {/* Today's Schedule — timeline style */}
          <section>
            <h2 className="text-xl font-bold tracking-tight mb-4">Today's Schedule</h2>
            <div className="glass-card p-4 space-y-0">
              {todayPlans.length > 0 ? (
                MEAL_SLOTS.map(slot => {
                  const plan = todayPlans.find(p => p.meal_slot === slot);
                  if (!plan) return null;
                  const isActive = slot === 'lunch';
                  return (
                    <button
                      key={slot}
                      onClick={() => navigate('/meal-planner')}
                      className={`w-full flex items-center gap-4 py-3.5 border-b border-border/40 last:border-0 text-left transition-colors rounded-lg px-3 ${isActive ? 'bg-primary/5' : 'hover:bg-surface-low/50'}`}
                    >
                      <span className={`text-sm font-bold w-14 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                        {slot === 'breakfast' ? '08:00' : slot === 'lunch' ? '12:30' : slot === 'dinner' ? '19:00' : '15:00'}
                      </span>
                      <div className={`w-px h-8 shrink-0 ${isActive ? 'bg-primary' : 'bg-border'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{plan.title}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">
                          {plan.status === 'planned' ? 'Planned' : plan.status === 'cooked' ? 'Completed' : plan.status}
                          {isActive && ' · Active Task'}
                        </p>
                      </div>
                      {plan.image && (
                        <img src={plan.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      )}
                    </button>
                  );
                })
              ) : (
                <button
                  onClick={() => navigate('/meal-planner')}
                  className="w-full flex items-center gap-3 py-3 text-left"
                >
                  <div className="icon-container bg-primary/8">
                    <CalendarDays className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">No meals planned</p>
                    <p className="text-[11px] text-muted-foreground">Tap to plan your meals for the week</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </button>
              )}
            </div>
          </section>

          {/* Quick actions - mobile only */}
          <div className="md:hidden space-y-3">
            <h2 className="section-title">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Log a Meal', icon: Camera, path: '/meal-log' },
                { label: 'Weekly Insights', icon: TrendingUp, path: '/weekly-insights' },
                { label: 'Scan Receipt', icon: Clock, path: '/add-food' },
                { label: 'Shopping List', icon: ShoppingCart, path: '/shopping-list' },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className="glass-card p-3.5 flex flex-col items-start gap-2.5 text-left"
                >
                  <div className="icon-container bg-primary/8">
                    <action.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs font-bold">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — sidebar */}
        <div className="space-y-5">
          {/* Calorie Tracker */}
          <CalorieTracker />

          {/* Taste Profile — what the AI has learned */}
          <TasteProfileCard />
          {/* Inventory Status */}
          <div className="glass-card p-5">
            <h3 className="section-title mb-5">Inventory Status</h3>
            <div className="space-y-5">
              {(Object.keys(counts) as StorageLocation[]).map((loc) => {
                const capacity = loc === 'fridge' ? 50 : loc === 'freezer' ? 30 : 150;
                const percent = Math.min(100, Math.round((counts[loc] / capacity) * 100));
                return (
                  <button
                    key={loc}
                    onClick={() => navigate('/inventory')}
                    className="w-full text-left group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        {LOCATION_ICONS[loc]}
                        <span className="text-sm font-semibold">{LOCATION_LABELS[loc]}</span>
                      </div>
                      <span className="text-sm font-bold">{counts[loc]} Items</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-high overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/50 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shopping List */}
          <button
            onClick={() => navigate('/shopping-list')}
            className="glass-card p-5 w-full text-left"
          >
            <div className="flex items-center justify-between">
              <h3 className="section-title">Shopping List</h3>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>

          {/* Weekly Impact */}
          <div className="glass-card p-5">
            <p className="section-title mb-3">Weekly Impact</p>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold">Zero Waste Goal</p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Track your progress in reducing food waste and optimizing your kitchen.
            </p>
          </div>

          {/* Quick Actions — desktop */}
          <div className="hidden md:block space-y-2">
            {[
              { label: 'Log a Meal', icon: Camera, path: '/meal-log' },
              { label: 'Weekly Insights', icon: TrendingUp, path: '/weekly-insights' },
              { label: 'Scan Receipt', icon: Clock, path: '/add-food' },
            ].map(action => (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="w-full glass-card p-3.5 flex items-center gap-3 text-left"
              >
                <div className="icon-container bg-primary/8">
                  <action.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-bold">{action.label}</span>
              </button>
            ))}
          </div>
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
