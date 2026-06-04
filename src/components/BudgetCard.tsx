import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, AlertTriangle, Check } from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function BudgetCard() {
  const { session, preferences } = useApp();
  const navigate = useNavigate();
  const [spent, setSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!session?.user) return;
      const start = startOfMonth(new Date());
      const end = endOfMonth(new Date());
      const { data } = await supabase
        .from('receipt_reconciliations')
        .select('total_gbp')
        .eq('user_id', session.user.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
      if (cancelled) return;
      const sum = (data || []).reduce((s: number, r: any) => s + Number(r.total_gbp || 0), 0);
      setSpent(sum);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const budget = preferences.monthlyBudgetGbp ?? 0;

  if (!budget) {
    return (
      <button
        onClick={() => navigate('/settings')}
        className="glass-card p-5 w-full text-left hover:bg-surface-low/50 transition-colors"
      >
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-4 h-4 text-primary" />
          <p className="section-title">Set a grocery budget</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Add your monthly grocery budget in Settings to track spend and let the AI plan within your means.
        </p>
      </button>
    );
  }

  const percent = Math.min(100, Math.round((spent / budget) * 100));
  const remaining = Math.max(0, budget - spent);
  const today = new Date();
  const daysInMonth = endOfMonth(today).getDate();
  const dayOfMonth = today.getDate();
  const expectedPercent = Math.round((dayOfMonth / daysInMonth) * 100);
  const overPace = percent > expectedPercent + 10;
  const onTrack = percent <= expectedPercent + 5;

  const barColor = percent >= 100 ? 'bg-destructive' : overPace ? 'bg-warning' : 'bg-primary';

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <p className="section-title">Grocery Budget</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {format(today, 'MMMM')}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-2xl font-extrabold font-display tabular-nums">£{spent.toFixed(2)}</span>
        <span className="text-xs text-muted-foreground">of £{budget.toFixed(0)}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-high overflow-hidden mb-2">
        <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${percent}%` }} />
      </div>
      <div className="flex items-center gap-1.5 text-[11px]">
        {percent >= 100 ? (
          <>
            <AlertTriangle className="w-3 h-3 text-destructive" />
            <span className="text-destructive font-semibold">Over budget by £{(spent - budget).toFixed(2)}</span>
          </>
        ) : overPace ? (
          <>
            <AlertTriangle className="w-3 h-3 text-warning" />
            <span className="text-warning font-semibold">Ahead of pace — £{remaining.toFixed(2)} left</span>
          </>
        ) : onTrack ? (
          <>
            <Check className="w-3 h-3 text-success" />
            <span className="text-success font-semibold">On track — £{remaining.toFixed(2)} left</span>
          </>
        ) : (
          <span className="text-muted-foreground">£{remaining.toFixed(2)} remaining this month</span>
        )}
      </div>
    </div>
  );
}
