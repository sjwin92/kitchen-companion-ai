import { NavLink } from 'react-router-dom';
import { Home, Package, Plus, ShoppingCart, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/inventory', icon: Package, label: 'Pantry' },
  { to: '/add-food', icon: Plus, label: 'Add', isCenter: true },
  { to: '/shopping', icon: ShoppingCart, label: 'Shop' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border/60 z-50">
      <div className="max-w-lg mx-auto flex items-end">
        {NAV_ITEMS.map(({ to, icon: Icon, label, isCenter }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 transition-all duration-200 ${
                isCenter
                  ? 'pb-2 pt-1.5'
                  : 'py-2.5'
              } ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isCenter ? (
                  <div className="w-11 h-11 -mt-4 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 active:scale-95 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="relative">
                    <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                    {isActive && (
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </div>
                )}
                <span className={`text-[10px] font-medium ${isCenter ? 'mt-0.5' : ''}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
