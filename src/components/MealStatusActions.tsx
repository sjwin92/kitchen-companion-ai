import { Check, UtensilsCrossed, SkipForward, ArrowLeftRight } from 'lucide-react';

export type MealStatus = 'planned' | 'cooked' | 'eaten' | 'skipped' | 'swapped';

const STATUS_CONFIG: Record<MealStatus, { icon: typeof Check; label: string; color: string }> = {
  planned: { icon: Check, label: 'Planned', color: 'text-muted-foreground' },
  cooked: { icon: UtensilsCrossed, label: 'Cooked', color: 'text-amber-500' },
  eaten: { icon: Check, label: 'Eaten', color: 'text-green-500' },
  skipped: { icon: SkipForward, label: 'Skipped', color: 'text-muted-foreground' },
  swapped: { icon: ArrowLeftRight, label: 'Swapped', color: 'text-blue-500' },
};

interface Props {
  status: MealStatus;
  onStatusChange: (status: MealStatus) => void;
}

export default function MealStatusActions({ status, onStatusChange }: Props) {
  const actions: MealStatus[] = ['cooked', 'eaten', 'skipped'];

  return (
    <div className="flex items-center gap-1">
      {actions.map(s => {
        const cfg = STATUS_CONFIG[s];
        const Icon = cfg.icon;
        const isActive = status === s;
        return (
          <button
            key={s}
            onClick={(e) => { e.stopPropagation(); onStatusChange(isActive ? 'planned' : s); }}
            className={`p-1 rounded-md transition-colors ${isActive ? `bg-${s === 'eaten' ? 'green' : s === 'cooked' ? 'amber' : 'muted'}-500/15 ${cfg.color}` : 'hover:bg-muted text-muted-foreground/50'}`}
            title={cfg.label}
          >
            <Icon className="w-3 h-3" />
          </button>
        );
      })}
    </div>
  );
}
