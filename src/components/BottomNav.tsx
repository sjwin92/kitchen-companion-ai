import { NavLink } from 'react-router-dom';
import { BookOpen, CalendarDays, Home, Package, Plus } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Today' },
  { to: '/inventory', icon: Package, label: 'Pantry' },
  { to: '/add-food', icon: Plus, label: 'Capture', primary: true },
  { to: '/meals', icon: BookOpen, label: 'Library' },
  { to: '/meal-planner', icon: CalendarDays, label: 'Plan' },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.55rem,env(safe-area-inset-bottom))] md:hidden" aria-label="Primary navigation">
      <div className="mx-auto flex max-w-md items-end rounded-[1.55rem] border border-white/70 bg-[#fffdf9]/95 px-1.5 py-1.5 shadow-[0_18px_55px_rgba(24,53,44,0.2)] backdrop-blur-xl">
        {NAV_ITEMS.map(({ to, icon: Icon, label, primary }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={primary ? 'Capture food' : label}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-[1.15rem] py-2 text-[9px] font-bold tracking-[0.05em] transition-colors ${
                primary
                  ? 'mx-0.5 bg-[#173d32] text-white shadow-[0_8px_22px_rgba(23,61,50,0.24)]'
                  : isActive
                    ? 'text-[#173d32]'
                    : 'text-[#7f8883] hover:text-[#173d32]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`${primary ? 'h-5 w-5' : 'h-[18px] w-[18px]'} ${isActive && !primary ? 'stroke-[2.4]' : ''}`} />
                <span className="truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
