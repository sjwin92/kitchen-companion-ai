import { useApp } from '@/context/AppContext';
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

export default function UseSoon() {
  const { inventory } = useApp();

  const useToday = inventory.filter(i => i.status === 'use-today');
  const useSoon = inventory.filter(i => i.status === 'use-soon');
  const okay = inventory.filter(i => i.status === 'okay');

  const Section = ({ title, icon, items, variant }: { title: string; icon: React.ReactNode; items: typeof inventory; variant: string }) => (
    items.length > 0 ? (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-semibold text-sm">{title}</h2>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{item.quantity}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${variant}`}>
                {item.daysUntilExpiry <= 1 ? 'Today' : `${item.daysUntilExpiry}d`}
              </span>
            </div>
          ))}
        </div>
      </div>
    ) : null
  );

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Use Soon</h1>
        <p className="text-sm text-muted-foreground">Prioritized by freshness</p>
      </div>

      <Section title="Use Today" icon={<AlertTriangle className="w-4 h-4 text-destructive" />} items={useToday} variant="status-urgent" />
      <Section title="Use Soon" icon={<Clock className="w-4 h-4 text-warning" />} items={useSoon} variant="status-soon" />
      <Section title="Okay for Later" icon={<CheckCircle2 className="w-4 h-4 text-success" />} items={okay} variant="status-okay" />

      {inventory.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No items in your inventory yet</p>
        </div>
      )}
    </div>
  );
}
