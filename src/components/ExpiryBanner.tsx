import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export default function ExpiryBanner() {
  const { inventory } = useApp();
  const navigate = useNavigate();

  const expiring = inventory.filter(i => i.daysUntilExpiry <= 2);
  if (expiring.length === 0) return null;

  const todayCount = expiring.filter(i => i.daysUntilExpiry <= 1).length;

  return (
    <button
      onClick={() => navigate('/use-soon')}
      className="w-full glass-card bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent border-destructive/20 p-3.5 flex items-center gap-3 text-left group active:scale-[0.98] transition-all"
    >
      <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-destructive">
          {todayCount > 0
            ? `${todayCount} item${todayCount > 1 ? 's' : ''} expiring today!`
            : `${expiring.length} item${expiring.length > 1 ? 's' : ''} expiring soon`}
        </p>
        <p className="text-xs text-destructive/70 truncate">
          {expiring.slice(0, 3).map(i => i.name).join(', ')}
          {expiring.length > 3 ? ` +${expiring.length - 3} more` : ''}
        </p>
      </div>
      <ArrowRight className="w-4 h-4 text-destructive/50 group-hover:translate-x-0.5 transition-transform shrink-0" />
    </button>
  );
}
