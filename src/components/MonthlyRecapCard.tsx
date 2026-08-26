import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';
import { TrendingUp, TrendingDown, Sparkles } from 'lucide-react';

interface Recap {
  spent: number;
  budget: number;
  mealsCooked: number;
  wasteCount: number;
}

export default function MonthlyRecapCard() {
  const { session, preferences } = useApp();
  const userId = session?.user?.id;
  const [recap, setRecap] = useState<Recap | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) return;
      const lastMonth = subMonths(new Date(), 1);
      const start = startOfMonth(lastMonth).toISOString();
      const end = endOfMonth(lastMonth).toISOString();
      const [receipts, meals, waste] = await Promise.all([
        supabase.from('receipt_reconciliations').select('total_gbp')
          .eq('user_id', userId).gte('created_at', start).lte('created_at', end),
        supabase.from('meal_log').select('id', { count: 'exact', head: true })
          .eq('user_id', userId).gte('logged_at', start).lte('logged_at', end),
        supabase.from('waste_log').select('id', { count: 'exact', head: true })
          .eq('user_id', userId).gte('wasted_at', start).lte('wasted_at', end),
      ]);
      if (cancelled) return;
      const spent = (receipts.data || []).reduce(
        (total, receipt) => total + Number(receipt.total_gbp || 0),
        0,
      );
      setRecap({
        spent,
        budget: preferences.monthlyBudgetGbp ?? 0,
        mealsCooked: meals.count ?? 0,
        wasteCount: waste.count ?? 0,
      });
    };
    load();
    return () => { cancelled = true; };
  }, [userId, preferences.monthlyBudgetGbp]);

  if (!recap) return null;
  const lastMonth = subMonths(new Date(), 1);
  const savings = recap.budget > 0 ? recap.budget - recap.spent : 0;
  const overspent = savings < 0;

  // Hide if no data at all
  if (recap.spent === 0 && recap.mealsCooked === 0 && recap.wasteCount === 0) return null;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title">Last Month Recap</p>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {format(lastMonth, 'MMMM')}
        </span>
      </div>
      <div className="space-y-3">
        {recap.budget > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {overspent
                ? <TrendingUp className="w-4 h-4 text-destructive" />
                : <TrendingDown className="w-4 h-4 text-success" />
              }
              <span className="text-sm">{overspent ? 'Over budget' : 'Saved'}</span>
            </div>
            <span className={`text-sm font-bold tabular-nums ${overspent ? 'text-destructive' : 'text-success'}`}>
              {overspent ? '+' : '−'}£{Math.abs(savings).toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm">Meals cooked</span>
          </div>
          <span className="text-sm font-bold tabular-nums">{recap.mealsCooked}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-warning" />
            <span className="text-sm">Items wasted</span>
          </div>
          <span className="text-sm font-bold tabular-nums">{recap.wasteCount}</span>
        </div>
      </div>
    </div>
  );
}
