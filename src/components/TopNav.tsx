import { NavLink } from 'react-router-dom';
import { Search, User, Menu } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/meals', label: 'Recipes' },
  { to: '/meal-planner', label: 'Plan' },
  { to: '/shopping-list', label: 'Shop' },
  { to: '/settings', label: 'Settings' },
];

export default function TopNav() {
  return (
    <header className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-[hsl(160_12%_20%)] text-white">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left: Brand + hamburger */}
        <div className="flex items-center gap-6">
          <button className="p-1.5 rounded hover:bg-white/10 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <NavLink to="/" className="text-sm font-extrabold tracking-[0.12em] uppercase">
            Kitchen Companion
          </NavLink>
        </div>

        {/* Center: Nav links */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-4 py-1.5 text-[10px] font-bold tracking-[0.14em] uppercase rounded-md transition-all ${
                  isActive
                    ? 'border border-white/30 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/8'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/8 transition-colors">
            <Search className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center overflow-hidden">
            <User className="w-4 h-4 text-white/70" />
          </div>
        </div>
      </div>
    </header>
  );
}
