import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, TrendingDown, Calendar, BarChart3 } from 'lucide-react';
import { format, subDays, isAfter, startOfWeek, endOfWeek, eachWeekOfInterval, subWeeks } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface WasteEntry {
  id: string;
  name: string;
  quantity: string;
  reason: string;
  wasted_at: string;
}

const REASON_COLORS: Record<string, string> = {
  expired: 'hsl(0, 72%, 51%)',
  spoiled: 'hsl(38, 92%, 50%)',
  'not-needed': 'hsl(200, 15%, 50%)',
  other: 'hsl(152, 32%, 45%)',
};

const REASON_LABELS: Record<string, string> = {
  expired: 'Expired',
  spoiled: 'Spoiled',
  'not-needed': 'Not needed',
  other: 'Other',
};

export default function WasteTracker() {
  const { session } = useApp();
  const [entries, setEntries] = useState<WasteEntry[]>([]);
  const [showCharts, setShowCharts] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('waste_log')
      .select('*')
      .eq('user_id', session.user.id)
      .order('wasted_at', { ascending: false });
    if (data) setEntries(data);
  }, [session?.user?.id]);

  useEffect(() => { load(); }, [load]);

  const thisWeek = entries.filter(e => isAfter(new Date(e.wasted_at), subDays(new Date(), 7)));
  const thisMonth = entries.filter(e => isAfter(new Date(e.wasted_at), subDays(new Date(), 30)));

  // Weekly trend data (last 8 weeks)
  const weeklyData = useMemo(() => {
    const now = new Date();
    const weeks = eachWeekOfInterval({
      start: subWeeks(now, 7),
      end: now,
    }, { weekStartsOn: 1 });

    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const count = entries.filter(e => {
        const d = new Date(e.wasted_at);
        return d >= weekStart && d <= weekEnd;
      }).length;

      return {
        week: format(weekStart, 'dd MMM'),
        items: count,
      };
    });
  }, [entries]);

  // Reason breakdown for pie chart
  const reasonData = useMemo(() => {
    const counts: Record<string, number> = {};
    thisMonth.forEach(e => {
      counts[e.reason] = (counts[e.reason] || 0) + 1;
    });
    return Object.entries(counts).map(([reason, count]) => ({
      name: REASON_LABELS[reason] || reason,
      value: count,
      color: REASON_COLORS[reason] || 'hsl(200, 10%, 60%)',
    }));
  }, [thisMonth]);

  // Estimated savings (rough £2/item average)
  const estimatedSavings = thisMonth.length * 2;

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Waste Tracker</h1>
        <p className="text-sm text-muted-foreground">Track and reduce food waste</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center animate-fade-in" style={{ animationDelay: '0ms', animationFillMode: 'backwards' }}>
          <div className="text-2xl font-bold text-destructive">{thisWeek.length}</div>
          <div className="text-xs text-muted-foreground">This Week</div>
        </div>
        <div className="glass-card p-4 text-center animate-fade-in" style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}>
          <div className="text-2xl font-bold text-warning">{thisMonth.length}</div>
          <div className="text-xs text-muted-foreground">This Month</div>
        </div>
        <div className="glass-card p-4 text-center animate-fade-in" style={{ animationDelay: '160ms', animationFillMode: 'backwards' }}>
          <div className="text-2xl font-bold text-primary">~£{estimatedSavings}</div>
          <div className="text-xs text-muted-foreground">Est. Cost</div>
        </div>
      </div>

      {/* Tip */}
      {thisMonth.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Tip</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {thisWeek.length === 0
              ? 'Great job! No waste this week. Keep it up!'
              : thisWeek.length <= 2
                ? 'Not bad! Try planning meals around items expiring soon.'
                : 'Consider buying smaller quantities or freezing items before they expire.'}
          </p>
        </div>
      )}

      {/* Charts Toggle */}
      {entries.length > 0 && (
        <button
          onClick={() => setShowCharts(prev => !prev)}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <BarChart3 className="w-4 h-4" />
          {showCharts ? 'Hide Charts' : 'Show Charts'}
        </button>
      )}

      {/* Weekly Trend Chart */}
      {showCharts && entries.length > 0 && (
        <div className="glass-card p-4 space-y-3 animate-fade-in">
          <h2 className="font-semibold text-sm">Weekly Trend</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="items" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Reason Breakdown Pie */}
      {showCharts && reasonData.length > 0 && (
        <div className="glass-card p-4 space-y-3 animate-fade-in">
          <h2 className="font-semibold text-sm">Reasons (This Month)</h2>
          <div className="flex items-center gap-4">
            <div className="h-32 w-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reasonData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={55}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {reasonData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {reasonData.map(entry => (
                <div key={entry.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                  <span className="font-medium ml-auto">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Log */}
      {entries.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</h2>
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className="glass-card p-3 flex items-center justify-between animate-fade-in"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
            >
              <div>
                <span className="text-sm font-medium">{entry.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{entry.quantity}</span>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(entry.wasted_at), 'dd MMM yyyy')}
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {REASON_LABELS[entry.reason] || entry.reason}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No waste logged yet — great!</p>
          <p className="text-xs mt-1">Items you discard from inventory will appear here</p>
        </div>
      )}
    </div>
  );
}
