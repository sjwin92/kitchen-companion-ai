import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirstWin } from '@/hooks/useFirstWin';
import { Check, Package, CalendarDays, Camera, ShoppingCart, ChefHat, Sparkles, ChevronDown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const STEPS = [
  { key: 'inventoryAdded' as const, label: 'Add items to inventory', icon: Package, path: '/add-food' },
  { key: 'recipeViewed' as const, label: 'Explore a recipe', icon: ChefHat, path: '/meals' },
  { key: 'mealPlanned' as const, label: 'Plan a meal', icon: CalendarDays, path: '/meal-planner' },
  { key: 'mealLogged' as const, label: 'Log a meal', icon: Camera, path: '/meal-log' },
  { key: 'groceryGenerated' as const, label: 'Start a shopping list', icon: ShoppingCart, path: '/shopping' },
];

export default function FirstWinCard() {
  const navigate = useNavigate();
  const { progress, loading } = useFirstWin();
  const [open, setOpen] = useState(true);

  if (loading || progress.allComplete) return null;

  const pct = Math.round((progress.completedCount / progress.totalSteps) * 100);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="glass-card p-4 space-y-3 animate-fade-in border-primary/20">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold">Get Started</h2>
            <span className="text-[10px] text-muted-foreground ml-auto mr-1">{progress.completedCount}/{progress.totalSteps}</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>

        <Progress value={pct} className="h-1.5" />

        <CollapsibleContent>
          <div className="space-y-1 pt-1">
            {STEPS.map(step => {
              const done = progress[step.key];
              const Icon = step.icon;
              return (
                <button
                  key={step.key}
                  onClick={() => !done && navigate(step.path)}
                  disabled={done}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all ${
                    done
                      ? 'opacity-50'
                      : 'hover:bg-primary/5 active:scale-[0.98]'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    done ? 'bg-primary/15' : 'border border-border'
                  }`}>
                    {done ? (
                      <Check className="w-3 h-3 text-primary" />
                    ) : (
                      <Icon className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <span className={`text-xs font-medium ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
