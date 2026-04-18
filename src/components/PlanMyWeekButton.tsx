import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { useAutoPlan } from '@/hooks/useAutoPlan';
import { useMealPlans, MEAL_SLOTS, type MealSlot } from '@/hooks/useMealPlans';
import { useShoppingDerivation } from '@/hooks/useShoppingDerivation';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Loader2, Check, ShoppingCart, CalendarDays, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { startOfWeek, addDays, format } from 'date-fns';
import { toast } from 'sonner';

interface GeneratedMeal {
  date: string;
  slot: string;
  title: string;
  search_term: string;
  image?: string;
}

type Stage = 'idle' | 'planning' | 'saving' | 'shopping' | 'done';

export default function PlanMyWeekButton() {
  const navigate = useNavigate();
  const { session } = useApp();
  const { generatePlan, generating } = useAutoPlan();
  const { plans, refetch } = useMealPlans();
  const { deriveFromPlans, addDerivedToShoppingList, derivedItems, totalEstimate } =
    useShoppingDerivation();

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [savedMeals, setSavedMeals] = useState<GeneratedMeal[]>([]);
  const [missingCount, setMissingCount] = useState(0);
  const [estimate, setEstimate] = useState(0);

  const run = async () => {
    if (!session?.user) {
      toast.error('Please sign in first');
      return;
    }
    setOpen(true);
    setStage('planning');
    setSavedMeals([]);

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    // 1. Generate plan
    const meals = await generatePlan(days, plans);
    if (meals.length === 0) {
      setStage('idle');
      setOpen(false);
      return;
    }

    // 2. Save plans to DB
    setStage('saving');
    const rows = meals.map(m => ({
      user_id: session.user.id,
      recipe_id: m.search_term ? `auto-${m.search_term}-${m.date}-${m.slot}` : `auto-${Date.now()}`,
      title: m.title,
      image: m.image ?? null,
      planned_date: m.date,
      meal_slot: m.slot,
    }));

    const { error } = await supabase
      .from('meal_plans')
      .upsert(rows, { onConflict: 'user_id,planned_date,meal_slot' });

    if (error) {
      toast.error('Failed to save plan');
      setStage('idle');
      setOpen(false);
      return;
    }
    setSavedMeals(meals);
    await refetch();

    // 3. Derive shopping list
    setStage('shopping');
    const missing = await deriveFromPlans();
    setMissingCount(missing.length);
    setEstimate(missing.reduce((s, m) => s + (m.estimatedPrice || 0), 0));

    setStage('done');
  };

  const confirmAndAddToShopping = async () => {
    await addDerivedToShoppingList();
    setOpen(false);
    setStage('idle');
    navigate('/meal-planner');
  };

  const skipShopping = () => {
    setOpen(false);
    setStage('idle');
    navigate('/meal-planner');
    toast.success(`Planned ${savedMeals.length} meals`);
  };

  return (
    <>
      <button
        onClick={run}
        disabled={generating || stage !== 'idle'}
        className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl text-xs font-bold tracking-[0.14em] uppercase text-primary-foreground transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-elegant, 0 4px 12px hsl(var(--primary) / 0.25))' }}
      >
        {stage === 'idle' ? (
          <>
            <Sparkles className="w-4 h-4" />
            Plan My Week
          </>
        ) : (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Working...
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={(o) => { if (!o && stage === 'done') skipShopping(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Planning Your Week
            </DialogTitle>
            <DialogDescription>
              We'll fill empty slots and derive a shopping list — one tap.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Step
              done={stage === 'saving' || stage === 'shopping' || stage === 'done'}
              active={stage === 'planning'}
              icon={<CalendarDays className="w-4 h-4" />}
              label="Generating meal suggestions"
            />
            <Step
              done={stage === 'shopping' || stage === 'done'}
              active={stage === 'saving'}
              icon={<CalendarDays className="w-4 h-4" />}
              label={savedMeals.length > 0 ? `Saving ${savedMeals.length} meal${savedMeals.length === 1 ? '' : 's'}` : 'Saving plans'}
            />
            <Step
              done={stage === 'done'}
              active={stage === 'shopping'}
              icon={<ShoppingCart className="w-4 h-4" />}
              label="Deriving shopping list"
            />
          </div>

          {stage === 'done' && (
            <div className="rounded-xl bg-surface-low p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-semibold">{savedMeals.length} meals planned</p>
                {missingCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {missingCount} item{missingCount === 1 ? '' : 's'} to buy
                    {estimate > 0 ? ` · ~£${estimate.toFixed(2)}` : ''}
                  </p>
                )}
              </div>

              {missingCount > 0 ? (
                <div className="flex gap-2">
                  <Button onClick={confirmAndAddToShopping} size="sm" className="flex-1 rounded-xl text-xs font-bold uppercase tracking-wider" style={{ background: 'var(--gradient-primary)' }}>
                    <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                    Add to Shopping
                  </Button>
                  <Button onClick={skipShopping} variant="outline" size="sm" className="rounded-xl text-xs">
                    Skip
                  </Button>
                </div>
              ) : (
                <Button onClick={skipShopping} size="sm" className="w-full rounded-xl text-xs font-bold uppercase tracking-wider" style={{ background: 'var(--gradient-primary)' }}>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  All Set — View Plan
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Step({ done, active, icon, label }: {
  done: boolean; active: boolean; icon: React.ReactNode; label: string;
}) {
  return (
    <div className={`flex items-center gap-3 transition-opacity ${!done && !active ? 'opacity-40' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        done ? 'bg-success/20 text-success' : active ? 'bg-primary/15 text-primary' : 'bg-surface-high text-muted-foreground'
      }`}>
        {done ? <Check className="w-4 h-4" /> : active ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      </div>
      <p className={`text-sm ${active || done ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</p>
    </div>
  );
}
