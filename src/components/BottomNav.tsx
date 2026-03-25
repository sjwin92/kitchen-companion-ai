import { NavLink } from 'react-router-dom';
import { Home, Package, Plus, ShoppingCart, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/inventory', icon: Package, label: 'Pantry' },
  { to: '/add-food', icon: Plus, label: 'Add', isCenter: true },
  { to: '/shopping-list', icon: ShoppingCart, label: 'Shop' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-lg mx-auto px-3 pb-1">
        <div
          className="flex items-end rounded-t-2xl border border-b-0 border-border/50"
          style={{
            background: 'var(--gradient-card)',
            backdropFilter: 'blur(20px) saturate(1.8)',
            boxShadow: '0 -4px 24px -6px hsl(var(--foreground) / 0.06)',
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
                      className="w-12 h-12 -mt-5 rounded-2xl text-primary-foreground flex items-center justify-center active:scale-90 transition-transform"
                      style={{
                        background: 'var(--gradient-primary)',
                        boxShadow: 'var(--shadow-glow-primary)',
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="relative">
                      <Icon className={`w-5 h-5 transition-all duration-200 ${isActive ? 'scale-110' : ''}`} />
                      {isActive && (
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                  )}
                  <span className={`text-[10px] font-medium ${isCenter ? 'mt-0.5' : ''}`}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
