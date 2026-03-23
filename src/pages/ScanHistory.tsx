import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { History, Receipt, Refrigerator, Snowflake, Archive, AlertCircle, CheckCircle2 } from 'lucide-react';

type ScanSession = {
  id: string;
  source_type: 'receipt' | 'fridge' | 'freezer' | 'cupboard';
  status: 'success' | 'failed';
  parsed_items: any[];
  error_message: string | null;
  created_at: string;
  raw_output: any;
};

const sourceMeta = {
  receipt: { label: 'Receipt', icon: Receipt },
  fridge: { label: 'Fridge', icon: Refrigerator },
  freezer: { label: 'Freezer', icon: Snowflake },
  cupboard: { label: 'Cupboard', icon: Archive },
};

export default function ScanHistory() {
  const { session } = useApp();
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSessions = async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('scan_sessions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSessions(data as ScanSession[]);
      }

      setLoading(false);
    };

    loadSessions();
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div className="p-4 pb-24 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-2">Scan History</h1>
        <p className="text-sm text-muted-foreground">Loading your past scans…</p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Scan History</h1>
        <p className="text-sm text-muted-foreground">Your recent receipt and kitchen scans</p>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">No scans yet</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            When you scan a receipt or your kitchen, it will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(scan => {
            const Icon = sourceMeta[scan.source_type]?.icon || History;
            const itemCount = Array.isArray(scan.parsed_items) ? scan.parsed_items.length : 0;

            return (
              <div key={scan.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold">
                        {sourceMeta[scan.source_type]?.label || scan.source_type}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(scan.created_at).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>

                  <div>
                    {scan.status === 'success' ? (
                      <span className="text-xs px-2 py-0.5 rounded-full border status-okay inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Success
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full border status-urgent inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Failed
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  {scan.status === 'success' ? (
                    <span>{itemCount} item{itemCount === 1 ? '' : 's'} parsed</span>
                  ) : (
                    <span>{scan.error_message or 'Scan failed'}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
