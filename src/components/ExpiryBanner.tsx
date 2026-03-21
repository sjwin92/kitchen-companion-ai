import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

export default function ExpiryBanner() {
  const { inventory } = useApp();
  const navigate = useNavigate();

  const expiring = inventory.filter(i => i.daysUntilExpiry <= 2);
  if (expiring.length === 0) return null;

  const todayCount = expiring.filter(i => i.daysUntilExpiry <= 1).length;

  return (
    <button
      onClick={() => navigate('/use-soon')}
      className="w-full bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-center gap-3 text-left hover:bg-destructive/15 transition-colors"
    >
      <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
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
    </button>
  );
}
