import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { MOCK_MEALS } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Check, Copy, ArrowLeft, ShoppingCart, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function MissingIngredients() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { inventory } = useApp();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const meal = MOCK_MEALS.find(m => m.id === id);
  if (!meal) return <div className="p-4">Meal not found</div>;

  const ownedNames = inventory.map(i => i.name.toLowerCase());
  const missing = meal.ingredients.filter(ing => !ownedNames.some(o => o.includes(ing.toLowerCase()) || ing.toLowerCase().includes(o)));

  const toggleCheck = (ing: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(ing) ? next.delete(ing) : next.add(ing);
      return next;
    });
  };

  const copyList = () => {
    const text = missing.filter(i => !checked.has(i)).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to meals
      </button>

      <div>
        <h1 className="text-2xl font-bold">{meal.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">Shopping list for missing ingredients</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-3 bg-muted/50 border-b border-border flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{missing.length} items needed</span>
        </div>
        <div className="divide-y divide-border">
          {missing.map(ing => (
            <button
              key={ing}
              onClick={() => toggleCheck(ing)}
              className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                checked.has(ing) ? 'bg-primary border-primary' : 'border-border'
              }`}>
                {checked.has(ing) && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
              <span className={`text-sm ${checked.has(ing) ? 'line-through text-muted-foreground' : 'font-medium'}`}>
                {ing}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={copyList} className="flex-1">
          <Copy className="w-4 h-4 mr-1" /> Copy List
        </Button>
        <Button onClick={() => toast.success('List saved!')} className="flex-1">
          Save List
        </Button>
      </div>
    </div>
  );
}
