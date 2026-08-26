import CalorieTracker from '@/components/CalorieTracker';
import { useApp } from '@/context/AppContext';
import { useMealPlans } from '@/hooks/useMealPlans';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  ChevronRight,
  CirclePlus,
  Leaf,
  ShoppingCart,
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const EDITORIAL_MEAL_IMAGE = `${import.meta.env.BASE_URL}images/editorial-cannellini-beans.jpg`;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { inventory, preferences } = useApp();
  const { plans } = useMealPlans();
  const navigate = useNavigate();

  const today = format(new Date(), 'yyyy-MM-dd');
  const activeInventory = inventory.filter(item => (item.status as string) !== 'used');
  const useSoonItems = activeInventory
    .filter(item => item.status === 'use-today' || item.status === 'use-soon')
    .sort((a, b) => (a.daysUntilExpiry ?? 999) - (b.daysUntilExpiry ?? 999));
  const todayPlans = plans.filter(plan => plan.planned_date === today);
  const tonight = todayPlans.find(plan => plan.meal_slot === 'dinner') ?? todayPlans[0];
  const comingUp = plans
    .filter(plan => plan.planned_date > today)
    .sort((a, b) => a.planned_date.localeCompare(b.planned_date))
    .slice(0, 2);

  const firstName = preferences.displayName?.trim().split(' ')[0];
  const heroTitle = tonight?.title || 'Creamy cannellini beans with spinach';
  const heroImage = tonight?.image || EDITORIAL_MEAL_IMAGE;

  const openTonight = () => {
    if (tonight?.recipe_id) {
      navigate(`/recipe/${tonight.recipe_id}`);
      return;
    }
    navigate('/meals');
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-9">
      <header className="mb-7 flex items-start justify-between md:mb-10">
        <div>
          <p className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.22em] text-primary md:hidden">
            Kitchen Companion
          </p>
          <p className="mb-1 text-sm font-semibold text-muted-foreground">{getGreeting()}{firstName ? `, ${firstName}` : ''}</p>
          <h1 className="max-w-xl text-[2rem] font-semibold leading-[1.08] tracking-[-0.045em] text-foreground md:text-[3.4rem]">
            What’s happening in your kitchen today?
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          aria-label="Open profile"
          className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d7c3aa] text-sm font-bold text-[#29463c] shadow-[0_5px_20px_rgba(41,70,60,0.12)] md:hidden"
        >
          {(firstName?.[0] || 'K').toUpperCase()}
        </button>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="tonight-heading">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">Tonight</p>
                <h2 id="tonight-heading" className="mt-1 text-xl font-semibold tracking-[-0.025em]">Your next good decision</h2>
              </div>
              <button type="button" onClick={() => navigate('/meal-planner')} className="text-xs font-bold text-primary hover:underline">
                Change plan
              </button>
            </div>

            <button
              type="button"
              onClick={openTonight}
              className="group relative block h-[420px] w-full overflow-hidden rounded-[2rem] bg-[#173d32] text-left shadow-[0_24px_70px_rgba(24,53,44,0.2)] md:h-[520px]"
            >
              <img
                src={heroImage}
                alt={heroTitle}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.025]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#102c25]/95 via-[#102c25]/15 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-9">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/75">
                  <span>{tonight ? 'Planned for dinner' : 'Kitchen Companion pick'}</span>
                  <span aria-hidden="true">•</span>
                  <span>{tonight?.prep_time || '25 min'}</span>
                </div>
                <h3 className="max-w-xl text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] md:text-[3rem]">{heroTitle}</h3>
                <div className="mt-5 flex items-center justify-between gap-4">
                  <p className="text-sm text-white/75">
                    {tonight ? 'Open your recipe and start cooking.' : 'Uses simple staples and keeps tonight effortless.'}
                  </p>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#173d32] transition-transform group-hover:translate-x-1">
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </div>
              </div>
            </button>
          </section>

          <section className="grid gap-3 sm:grid-cols-2" aria-label="Today at a glance">
            <button
              type="button"
              onClick={() => navigate('/use-soon')}
              className="min-h-[170px] rounded-[1.6rem] bg-[#173d32] p-5 text-left text-white shadow-[0_15px_40px_rgba(23,61,50,0.15)] transition-transform hover:-translate-y-0.5"
            >
              <div className="mb-8 flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><Leaf className="h-4 w-4" /></span>
                <ChevronRight className="h-4 w-4 text-white/60" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">Use soon</p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.04em]">{useSoonItems.length}</p>
              <p className="mt-1 truncate text-xs text-white/65">
                {useSoonItems.length ? useSoonItems.slice(0, 2).map(item => item.name).join(' · ') : 'Nothing needs rescuing today'}
              </p>
            </button>
            <CalorieTracker compact />
          </section>

          <section aria-labelledby="coming-up-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="coming-up-heading" className="text-xl font-semibold tracking-[-0.025em]">Coming up</h2>
              <button type="button" onClick={() => navigate('/meal-planner')} className="text-xs font-bold text-primary hover:underline">See the week</button>
            </div>
            <div className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-card shadow-[0_12px_40px_rgba(36,57,48,0.06)]">
              {comingUp.length ? comingUp.map((plan, index) => (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => navigate('/meal-planner')}
                  className="flex w-full items-center gap-4 border-b border-border/60 p-4 text-left last:border-0 hover:bg-muted/35"
                >
                  <div className="w-12 shrink-0 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      {format(new Date(`${plan.planned_date}T12:00:00`), 'EEE')}
                    </p>
                    <p className="mt-0.5 text-xl font-semibold">{format(new Date(`${plan.planned_date}T12:00:00`), 'd')}</p>
                  </div>
                  {plan.image ? (
                    <img src={plan.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#e9e4da]"><CalendarDays className="h-4 w-4 text-primary" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{plan.title}</p>
                    <p className="mt-0.5 text-xs capitalize text-muted-foreground">{plan.meal_slot}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )) : (
                <button type="button" onClick={() => navigate('/meal-planner')} className="flex w-full items-center gap-4 p-5 text-left hover:bg-muted/35">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e9e4da]"><CalendarDays className="h-4 w-4 text-primary" /></span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Give the week a little shape</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Plan a few meals now; keep the rest flexible.</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </section>
        </div>

        <aside className="hidden space-y-4 lg:block">
          <button
            type="button"
            onClick={() => navigate('/recipe-books')}
            className="w-full overflow-hidden rounded-[1.6rem] bg-[#e9e4da] p-5 text-left transition-transform hover:-translate-y-0.5"
          >
            <div className="mb-14 flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70"><BookOpen className="h-4 w-4 text-primary" /></span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-primary">Your cookbook shelf</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.035em]">Recipes worth coming back to.</h2>
          </button>

          <div className="overflow-hidden rounded-[1.6rem] border border-border/60 bg-card shadow-[0_12px_40px_rgba(36,57,48,0.06)]">
            {[
              { label: 'Add food', detail: 'Scan or enter', path: '/add-food', icon: CirclePlus },
              { label: 'Shopping list', detail: 'Buy what’s missing', path: '/shopping-list', icon: ShoppingCart },
              { label: 'Record a meal', detail: 'Calories and progress', path: '/meal-log', icon: Camera },
            ].map(action => (
              <button key={action.label} type="button" onClick={() => navigate(action.path)} className="flex w-full items-center gap-3 border-b border-border/60 p-4 text-left last:border-0 hover:bg-muted/35">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0ece3]"><action.icon className="h-4 w-4 text-primary" /></span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{action.label}</p>
                  <p className="text-[11px] text-muted-foreground">{action.detail}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>

          <button type="button" onClick={() => navigate('/meals')} className="w-full rounded-[1.6rem] border border-[#173d32]/10 bg-[#f6f1e8] p-5 text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Reviewed catalogue</p>
            <p className="mt-2 text-base font-semibold">Find something that fits your kitchen.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary">Browse recipes <ArrowRight className="h-3.5 w-3.5" /></span>
          </button>
        </aside>
      </div>
    </main>
  );
}
