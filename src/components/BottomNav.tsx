import { NavLink } from 'react-router-dom';
import { Home, Package, Plus, ShoppingCart, CalendarDays, BookOpen } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/recipe-books', icon: BookOpen, label: 'Recipes' },
  { to: '/meal-planner', icon: CalendarDays, label: 'Plan' },
  { to: '/shopping-list', icon: ShoppingCart, label: 'Shop' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="max-w-lg mx-auto px-3 pb-1">
        <div
          className="flex items-end rounded-t-xl border border-b-0 border-border/40"
          style={{
            background: 'hsl(var(--card))',
            backdropFilter: 'blur(20px) saturate(1.6)',
            boxShadow: '0 -2px 16px -4px hsl(var(--foreground) / 0.06)',
          }}
        >
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-3 transition-all duration-200 ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon className={`w-[18px] h-[18px] transition-all duration-200 ${isActive ? 'scale-110' : ''}`} />
                    {isActive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
                  </div>
                  <span className="text-[9px] font-bold tracking-wide uppercase">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
      <NavLink
        to="/add-food"
        aria-label="Add or scan food"
        className="fixed right-4 bottom-20 w-12 h-12 rounded-2xl text-primary-foreground flex items-center justify-center active:scale-90 transition-transform"
        style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-glow-primary)' }}
      >
        <Plus className="w-5 h-5" />
      </NavLink>
    </nav>
  );
}
