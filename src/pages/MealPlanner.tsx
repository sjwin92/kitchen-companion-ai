import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { startOfWeek, addDays, addWeeks, format, isToday } from 'date-fns';
import { useMealPlans, MEAL_SLOTS, type MealSlot } from '@/hooks/useMealPlans';
import { useFavorites } from '@/hooks/useFavorites';
import { useMealDragDrop } from '@/hooks/useMealDragDrop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Plus, X, CalendarDays, Search, Loader2, ShoppingCart, GripVertical } from 'lucide-react';
import { useGroceryGenerator } from '@/hooks/useGroceryGenerator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const SLOT_COLORS: Record<MealSlot, string> = {
  breakfast: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
  lunch: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20',
  dinner: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/20',
  snack: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
};

const SLOT_EMOJI: Record<MealSlot, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

export default function MealPlanner() {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [addDialog, setAddDialog] = useState<{ date: Date; slot: MealSlot } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; thumb: string }>>([]);
  const [searching, setSearching] = useState(false);

  const weekStart = useMemo(
    () => {
      const base = startOfWeek(new Date(), { weekStartsOn: 1 });
      return weekOffset === 0 ? base : addWeeks(base, weekOffset);
    },
    [weekOffset]
  );

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const { plans, loading, addPlan, removePlan, movePlan } = useMealPlans(weekStart);
  const { favorites } = useFavorites();
  const { generate, generating } = useGroceryGenerator();
  const {
    draggingPlanId,
    dragOverTarget,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useMealDragDrop();

  const handleDrop = async (e: React.DragEvent, day: Date, slot: MealSlot) => {
    e.preventDefault();
    handleDragEnd();
    if (!draggingPlanId) return;

    const plan = plans.find(p => p.id === draggingPlanId);
    if (!plan) return;
    if (plan.planned_date === format(day, 'yyyy-MM-dd') && plan.meal_slot === slot) return;

    const success = await movePlan(draggingPlanId, day, slot);
    if (success) {
      toast.success(`Moved ${plan.title} to ${slot}`);
    } else {
      toast.error('Failed to move meal');
    }
  };

  const handleTouchDrop = async (planId: string) => {
    const target = handleTouchEnd();
    if (!target) return;

    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    if (plan.planned_date === target.dayStr && plan.meal_slot === target.slot) return;

    const success = await movePlan(planId, target.day, target.slot);
    if (success) {
      toast.success(`Moved ${plan.title} to ${target.slot}`);
    } else {
      toast.error('Failed to move meal');
    }
  };

  const handleAddMeal = async (recipeId: string, title: string, image?: string) => {
    if (!addDialog) return;
    const success = await addPlan(recipeId, title, addDialog.date, addDialog.slot, image);
    if (success) {
      toast.success(`Added ${title} to ${addDialog.slot}`);
      setAddDialog(null);
      setSearchQuery('');
      setSearchResults([]);
    } else {
      toast.error('Failed to add meal');
    }
  };

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `https://${projectId}.supabase.co/functions/v1/mealdb-proxy?path=${encodeURIComponent(`search.php?s=${q}`)}`;
      const res = await fetch(url, {
        headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` },
      });
      const data = await res.json();
      setSearchResults(
        (data.meals ?? []).map((m: any) => ({ id: m.idMeal, name: m.strMeal, thumb: m.strMealThumb }))
      );
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  return (
    <div className="p-4 pb-28 max-w-lg mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meal Planner</h1>
          <p className="text-sm text-muted-foreground">Plan your week</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-xs gap-1.5"
          disabled={generating || plans.length === 0}
          onClick={() => generate(plans)}
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
          Grocery List
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant={weekOffset === 0 ? 'default' : 'outline'}
            size="sm"
            className="rounded-xl text-xs h-8 px-3"
            onClick={() => setWeekOffset(0)}
          >
            This Week
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Week label */}
      <p className="text-xs text-muted-foreground font-medium">
        {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
      </p>

      {loading && (
        <div className="glass-card p-6 text-center text-sm text-muted-foreground shimmer">
          Loading meal plans...
        </div>
      )}

      {/* Calendar grid */}
      <div className="space-y-3">
        {days.map(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayPlans = plans.filter(p => p.planned_date === dayStr);
          const today = isToday(day);

          return (
            <div
              key={dayStr}
              className={`glass-card overflow-hidden ${today ? 'ring-2 ring-primary/30' : ''}`}
            >
              <div className={`px-4 py-2.5 border-b border-border/40 flex items-center justify-between ${today ? 'bg-primary/5' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${today ? 'text-primary' : ''}`}>
                    {format(day, 'EEE')}
                  </span>
                  <span className="text-xs text-muted-foreground">{format(day, 'MMM d')}</span>
                  {today && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">Today</span>}
                </div>
              </div>

              <div className="p-2 space-y-1.5">
                {MEAL_SLOTS.map(slot => {
                  const plan = dayPlans.find(p => p.meal_slot === slot);
                  const dropKey = `${dayStr}-${slot}`;
                  const isOver = dragOverTarget === dropKey;
                  return (
                    <div
                      key={slot}
                      data-drop-slot={dropKey}
                      data-drop-day={dayStr}
                      data-drop-meal-slot={slot}
                      data-drop-day-iso={day.toISOString()}
                      className={`flex items-center gap-2 rounded-lg transition-colors ${isOver ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
                      onDragOver={e => handleDragOver(e, dayStr, slot)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, day, slot)}
                    >
                      <span className="text-xs w-14 shrink-0 text-muted-foreground capitalize flex items-center gap-1">
                        {SLOT_EMOJI[slot]} {slot}
                      </span>
                      {plan ? (
                        <div
                          draggable
                          onDragStart={() => handleDragStart(plan.id)}
                          onDragEnd={handleDragEnd}
                          onTouchStart={e => handleTouchStart(e, plan.id)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={() => handleTouchDrop(plan.id)}
                          className={`flex-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5 border cursor-grab active:cursor-grabbing select-none ${SLOT_COLORS[slot]} ${draggingPlanId === plan.id ? 'opacity-50 scale-95' : ''} transition-all`}
                        >
                          <GripVertical className="w-3 h-3 shrink-0 opacity-40" />
                          {plan.image && (
                            <img src={plan.image} alt="" className="w-7 h-7 rounded object-cover shrink-0 pointer-events-none" />
                          )}
                          <button
                            className="flex-1 text-left text-xs font-medium truncate hover:underline"
                            onClick={() => navigate(`/recipe/${plan.recipe_id}`)}
                          >
                            {plan.title}
                          </button>
                          <button
                            onClick={() => removePlan(plan.id)}
                            className="shrink-0 p-0.5 rounded hover:bg-foreground/10 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddDialog({ date: day, slot })}
                          className={`flex-1 flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground transition-colors ${isOver ? 'border-primary/40 bg-primary/5' : 'border-border/60 hover:bg-accent/50 hover:border-border'}`}
                        >
                          <Plus className="w-3 h-3" /> {isOver ? 'Drop here' : 'Add meal'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add meal dialog */}
      <Dialog open={!!addDialog} onOpenChange={open => { if (!open) { setAddDialog(null); setSearchQuery(''); setSearchResults([]); } }}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {addDialog && `Add ${addDialog.slot} · ${format(addDialog.date, 'EEE, MMM d')}`}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="favorites" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
            </TabsList>

            <TabsContent value="favorites" className="mt-3">
              {favorites.length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <CalendarDays className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">Save some favorites first!</p>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setAddDialog(null); navigate('/meals'); }}>
                    Browse Meals
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {favorites.map(fav => (
                    <button
                      key={fav.id}
                      className="w-full flex items-center gap-3 rounded-xl border border-border/50 p-2 hover:bg-accent/50 transition-colors text-left"
                      onClick={() => handleAddMeal(fav.recipe_id, fav.title, fav.image ?? undefined)}
                    >
                      {fav.image && (
                        <img src={fav.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fav.title}</p>
                        {fav.category && <p className="text-[10px] text-muted-foreground">{fav.category}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="search" className="mt-3 space-y-3">
              <form onSubmit={e => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
                <Input
                  placeholder="Search recipes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 h-9 text-sm"
                />
                <Button type="submit" size="sm" variant="outline" disabled={searching || searchQuery.trim().length < 2}>
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </form>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map(meal => (
                    <button
                      key={meal.id}
                      className="w-full flex items-center gap-3 rounded-xl border border-border/50 p-2 hover:bg-accent/50 transition-colors text-left"
                      onClick={() => handleAddMeal(`mealdb-${meal.id}`, meal.name, meal.thumb)}
                    >
                      {meal.thumb && (
                        <img src={meal.thumb} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      )}
                      <p className="text-sm font-medium truncate flex-1">{meal.name}</p>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.length === 0 && !searching && searchQuery.length >= 2 && (
                <p className="text-xs text-muted-foreground text-center py-4">No results found</p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
