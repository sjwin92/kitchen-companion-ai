import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Camera,
  CirclePlus,
  ClipboardCheck,
  Heart,
  Home,
  Menu,
  Package,
  Refrigerator,
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  User,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const NAV_ITEMS = [
  { to: '/', label: 'Today' },
  { to: '/inventory', label: 'Pantry' },
  { to: '/meals', label: 'Library' },
  { to: '/meal-planner', label: 'Plan' },
  { to: '/shopping-list', label: 'Shop' },
];

const KITCHEN_LOOP = [
  { path: '/add-food', label: 'Add food', description: 'Scan, photograph or enter food', icon: CirclePlus },
  { path: '/use-soon', label: 'Use soon', description: 'Prioritise food before it expires', icon: Refrigerator },
  { path: '/meal-planner', label: 'Plan meals', description: 'Build the week from your recipe shelf', icon: CalendarDays },
  { path: '/shopping-list', label: 'Buy missing items', description: 'Turn plans into one practical basket', icon: ShoppingCart },
  { path: '/record', label: 'Record the outcome', description: 'Track consumption, nutrition or waste', icon: ClipboardCheck },
];

const SEARCH_DESTINATIONS = [
  { path: '/', label: 'Home', description: 'Today in your kitchen', keywords: 'dashboard overview', icon: Home },
  { path: '/inventory', label: 'Inventory', description: 'Fridge, freezer and pantry', keywords: 'food stock cupboard', icon: Package },
  { path: '/add-food', label: 'Add food', description: 'Scan or enter groceries', keywords: 'barcode receipt camera', icon: CirclePlus },
  { path: '/use-soon', label: 'Use soon', description: 'Food nearing expiry', keywords: 'expiry waste', icon: Refrigerator },
  { path: '/meals', label: 'Discover recipes', description: 'Trusted recipes matched to your kitchen', keywords: 'suggestions cook', icon: Heart },
  { path: '/recipe-books', label: 'Recipe books', description: 'Your collectable recipe shelf', keywords: 'creator collection cookbook', icon: BookOpen },
  { path: '/meal-planner', label: 'Meal planner', description: 'Plan breakfast, lunch and dinner', keywords: 'calendar week', icon: CalendarDays },
  { path: '/shopping-list', label: 'Shopping list', description: 'Buy what your plans are missing', keywords: 'basket supermarket prices', icon: ShoppingCart },
  { path: '/record', label: 'Record an outcome', description: 'Say whether food was eaten or wasted', keywords: 'consumption calories discard', icon: ClipboardCheck },
  { path: '/meal-log', label: 'Log a meal', description: 'Record nutrition and consumption', keywords: 'calories photo camera', icon: Camera },
  { path: '/weekly-insights', label: 'Weekly insights', description: 'Nutrition, spending and waste trends', keywords: 'calories analytics', icon: BarChart3 },
  { path: '/waste', label: 'Waste tracker', description: 'Record and reduce food waste', keywords: 'discard expired', icon: Trash2 },
  { path: '/settings', label: 'Settings', description: 'Diet, household and account', keywords: 'profile preferences calories', icon: Settings },
];

export default function TopNav() {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(open => !open);
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  const openDestination = (path: string) => {
    setSearchOpen(false);
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 hidden border-b border-border/60 bg-[#fffdf9]/92 text-[#173d32] backdrop-blur-xl md:block">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button aria-label="Open kitchen menu" className="rounded p-1.5 transition-colors hover:bg-[#173d32]/5">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[360px] sm:max-w-[360px] overflow-y-auto">
              <SheetHeader className="pr-7">
                <SheetTitle className="font-display">Your kitchen loop</SheetTitle>
                <SheetDescription>Every feature should move food through this routine.</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-2">
                {KITCHEN_LOOP.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <SheetClose asChild key={item.path}>
                      <button onClick={() => openDestination(item.path)} className="w-full flex items-center gap-3 rounded-xl border border-border/60 p-3 text-left hover:bg-muted/50 transition-colors">
                        <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">{index + 1}. {item.label}</span>
                          <span className="block text-xs text-muted-foreground mt-0.5">{item.description}</span>
                        </span>
                      </button>
                    </SheetClose>
                  );
                })}
              </div>
              <div className="mt-7 pt-5 border-t border-border space-y-1">
                <p className="section-title mb-3">More</p>
                {SEARCH_DESTINATIONS.filter(item => ['/recipe-books', '/weekly-insights', '/waste', '/settings'].includes(item.path)).map(item => (
                  <SheetClose asChild key={item.path}>
                    <button onClick={() => openDestination(item.path)} className="w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-left hover:bg-muted/50">{item.label}</button>
                  </SheetClose>
                ))}
              </div>
            </SheetContent>
          </Sheet>
          <NavLink to="/" className="text-sm font-extrabold tracking-[0.12em] uppercase">
            Kitchen Companion
          </NavLink>
        </div>

        <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `px-4 py-1.5 text-[10px] font-bold tracking-[0.14em] uppercase rounded-md transition-all ${
                  isActive
                    ? 'bg-[#173d32] text-white'
                    : 'text-[#173d32]/55 hover:bg-[#173d32]/5 hover:text-[#173d32]'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            aria-label="Search Kitchen Companion"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[#173d32]/55 transition-colors hover:bg-[#173d32]/5 hover:text-[#173d32]"
          >
            <Search className="w-4 h-4" />
            <span className="hidden xl:inline text-[9px] font-bold tracking-wider">⌘K</span>
          </button>
          <NavLink
            to="/settings"
            aria-label="Open account settings"
            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#d7c3aa] transition-colors hover:bg-[#cdb494] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <User className="h-4 w-4 text-[#173d32]/70" />
          </NavLink>
        </div>
      </div>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogTitle className="sr-only">Search Kitchen Companion</DialogTitle>
        <DialogDescription className="sr-only">Search for a feature and open it directly.</DialogDescription>
        <CommandInput placeholder="Where do you want to go?" />
        <CommandList>
          <CommandEmpty>No matching feature found.</CommandEmpty>
          <CommandGroup heading="Kitchen Companion">
            {SEARCH_DESTINATIONS.map(item => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.path}
                  value={`${item.label} ${item.description} ${item.keywords}`}
                  onSelect={() => openDestination(item.path)}
                  className="gap-3"
                >
                  <Icon className="w-4 h-4 text-primary" />
                  <span>
                    <span className="block font-semibold">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{item.description}</span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}
