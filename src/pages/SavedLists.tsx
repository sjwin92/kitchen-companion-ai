import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';

export default function SavedLists() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the main shopping list — saved lists are now consolidated there
    navigate('/shopping-list', { replace: true });
  }, [navigate]);

  return (
    <div className="p-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <p className="mt-4 text-sm text-muted-foreground">Redirecting to Shopping List…</p>
    </div>
  );
}
