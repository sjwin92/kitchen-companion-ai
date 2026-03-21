import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, TrendingDown, Calendar } from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';

interface WasteEntry {
  id: string;
  name: string;
  quantity: string;
  reason: string;
  wasted_at: string;
}

export default function WasteTracker() {
  const { session } = useApp();
  const [entries, setEntries] = useState<WasteEntry[]>([]);

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

  const reasonLabels: Record<string, string> = {
    expired: 'Expired',
    spoiled: 'Spoiled',
    'not-needed': 'Not needed',
    other: 'Other',
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Waste Tracker</h1>
        <p className="text-sm text-muted-foreground">Track and reduce food waste</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-destructive">{thisWeek.length}</div>
          <div className="text-xs text-muted-foreground">This Week</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-warning">{thisMonth.length}</div>
          <div className="text-xs text-muted-foreground">This Month</div>
        </div>
      </div>

      {thisMonth.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
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

      {/* Log */}
      {entries.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</h2>
          {entries.map(entry => (
            <div key={entry.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">{entry.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{entry.quantity}</span>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(entry.wasted_at), 'dd MMM yyyy')}
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {reasonLabels[entry.reason] || entry.reason}
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
