import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CirclePlus, ClipboardCheck, Refrigerator, ShoppingCart } from 'lucide-react';

interface KitchenLoopProps {
  inventoryCount: number;
  expiringCount: number;
  todayPlanCount: number;
}

const KITCHEN_LOOP_STAGES = [
  {
    label: 'Add food',
    path: '/add-food',
    icon: CirclePlus,
    detail: ({ inventoryCount }: KitchenLoopProps) => `${inventoryCount} item${inventoryCount === 1 ? '' : 's'} tracked`,
  },
  {
    label: 'Use soon',
    path: '/use-soon',
    icon: Refrigerator,
    detail: ({ expiringCount }: KitchenLoopProps) => expiringCount > 0
      ? `${expiringCount} need${expiringCount === 1 ? 's' : ''} attention`
      : 'Nothing urgent',
  },
  {
    label: 'Plan meals',
    path: '/meal-planner',
    icon: CalendarDays,
    detail: ({ todayPlanCount }: KitchenLoopProps) => todayPlanCount > 0
      ? `${todayPlanCount} planned today`
      : 'Choose from your shelf',
  },
  {
    label: 'Buy missing',
    path: '/shopping-list',
    icon: ShoppingCart,
    detail: () => 'Build the smallest basket',
  },
  {
    label: 'Record',
    path: '/record',
    icon: ClipboardCheck,
    detail: () => 'Nutrition, use or waste',
  },
] as const;

export default function KitchenLoop(props: KitchenLoopProps) {
  return (
    <section aria-labelledby="kitchen-loop-title">
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <p className="section-title mb-1">Your kitchen loop</p>
          <h2 id="kitchen-loop-title" className="text-lg font-bold tracking-tight">One connected routine</h2>
        </div>
        <Link to="/recipe-books" className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary hover:underline">
          Recipe shelf
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        {KITCHEN_LOOP_STAGES.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <Link
              key={stage.path}
              to={stage.path}
              className={`glass-card min-h-28 p-3.5 flex flex-col text-left group ${index === KITCHEN_LOOP_STAGES.length - 1 ? 'col-span-2 md:col-span-1' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="w-7 h-7 rounded-lg bg-primary/8 text-primary flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-[9px] font-bold text-muted-foreground/70">0{index + 1}</span>
              </div>
              <div className="mt-auto pt-3">
                <p className="text-xs font-bold flex items-center gap-1">
                  {stage.label}
                  <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{stage.detail(props)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
