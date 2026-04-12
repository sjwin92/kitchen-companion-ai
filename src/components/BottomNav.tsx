import { NavLink } from 'react-router-dom';
import { Home, Package, Plus, ShoppingCart, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/add-food', icon: Plus, label: 'Add', isCenter: true },
  { to: '/shopping-list', icon: ShoppingCart, label: 'Shop' },
  { to: '/settings', icon: Settings, label: 'Settings' },
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
          {NAV_ITEMS.map(({ to, icon: Icon, label, isCenter }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 transition-all duration-200 ${
                  isCenter ? 'pb-2.5 pt-1.5' : 'py-3'
                } ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isCenter ? (
                    <div
                      className="w-11 h-11 -mt-5 rounded-xl text-primary-foreground flex items-center justify-center active:scale-90 transition-transform"
                      style={{
                        background: 'var(--gradient-primary)',
                        boxShadow: 'var(--shadow-glow-primary)',
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="relative">
                      <Icon className={`w-[18px] h-[18px] transition-all duration-200 ${isActive ? 'scale-110' : ''}`} />
                      {isActive && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                      )}
                    </div>
                  )}
                  <span className={`text-[9px] font-bold tracking-wide uppercase ${isCenter ? 'mt-0.5' : ''}`}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
