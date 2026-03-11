import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { MOCK_MEALS } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Clock, Check, ShoppingCart } from 'lucide-react';

export default function MealSuggestions() {
  const { inventory } = useApp();
  const navigate = useNavigate();

  const ownedNames = inventory.map(i => i.name.toLowerCase());

  const mealsWithStatus = MOCK_MEALS.map(meal => {
    const owned = meal.ingredients.filter(ing => ownedNames.some(o => o.includes(ing.toLowerCase()) || ing.toLowerCase().includes(o)));
    const missing = meal.ingredients.filter(ing => !ownedNames.some(o => o.includes(ing.toLowerCase()) || ing.toLowerCase().includes(o)));
    return { ...meal, owned, missing, matchPercent: Math.round((owned.length / meal.ingredients.length) * 100) };
  }).sort((a, b) => b.matchPercent - a.matchPercent);

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Meal Ideas</h1>
        <p className="text-sm text-muted-foreground">Based on what you have</p>
      </div>

      <div className="space-y-3">
        {mealsWithStatus.map(meal => (
          <div key={meal.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{meal.title}</h3>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {meal.prepTime}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{meal.description}</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-full h-2">
                <div
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{ width: `${meal.matchPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-primary">{meal.matchPercent}%</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {meal.owned.map(ing => (
                <span key={ing} className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 flex items-center gap-1">
                  <Check className="w-3 h-3" /> {ing}
                </span>
              ))}
              {meal.missing.map(ing => (
                <span key={ing} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                  {ing}
                </span>
              ))}
            </div>

            {meal.missing.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate(`/missing/${meal.id}`)}
              >
                <ShoppingCart className="w-4 h-4 mr-1" /> Missing {meal.missing.length} ingredient{meal.missing.length > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
