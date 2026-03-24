import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { startOfWeek, addDays, addWeeks, format, isToday } from 'date-fns';
import { useMealPlans, MEAL_SLOTS, type MealSlot } from '@/hooks/useMealPlans';
import { useFavorites } from '@/hooks/useFavorites';
import { useMealDragDrop } from '@/hooks/useMealDragDrop';
import { useMealSlotSettings } from '@/hooks/useMealSlotSettings';
import { useMealRatings } from '@/hooks/useMealRatings';
import { useAutoPlan } from '@/hooks/useAutoPlan';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, X, Loader2, ShoppingCart, GripVertical, Sparkles, Star, Check, UtensilsCrossed, SkipForward } from 'lucide-react';
import { useGroceryGenerator } from '@/hooks/useGroceryGenerator';
import AddMealDialog from '@/components/AddMealDialog';
import ProductInfoDialog from '@/components/ProductInfoDialog';
import PlanningModeSelector from '@/components/PlanningModeSelector';
import SlotSettingsDialog from '@/components/SlotSettingsDialog';
import GuidedSuggestions from '@/components/GuidedSuggestions';
import MealRatingDialog from '@/components/MealRatingDialog';
import { useInteractions } from '@/hooks/useInteractions';
import { supabase } from '@/integrations/supabase/client';
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
  const { preferences } = useApp();
  const [weekOffset, setWeekOffset] = useState(0);
  const [addDialog, setAddDialog] = useState<{ date: Date; slot: MealSlot } | null>(null);
  const [productInfoName, setProductInfoName] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<MealSlot | null>(null);
  const [guidedSlot, setGuidedSlot] = useState<{ date: Date; slot: MealSlot } | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{ recipeId: string; title: string; slot: string; planId: string } | null>(null);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return weekOffset === 0 ? base : addWeeks(base, weekOffset);
  }, [weekOffset]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const { plans, loading, addPlan, removePlan, movePlan, refetch: refetchPlans } = useMealPlans(weekStart);
  const { favorites } = useFavorites();
  const { generate, generating } = useGroceryGenerator();
  const { getSlotSettings, updateSlotSettings } = useMealSlotSettings();
  const { ratings, fetchRatings, addRating, getRatingForRecipe } = useMealRatings();
  const { track } = useInteractions();
  const { generatePlan, generating: autoGenerating, draft, clearDraft } = useAutoPlan();
  const {
    draggingPlanId, dragOverTarget,
    handleDragStart, handleDragEnd, handleDragOver, handleDragLeave,
    handleTouchStart, handleTouchMove, handleTouchEnd,
  } = useMealDragDrop();

  // Fetch ratings on mount
  useEffect(() => { fetchRatings(); }, [fetchRatings]);

  const isGuided = preferences.planningStyle === 'help-choose';
  const isAuto = preferences.planningStyle === 'do-it-for-me';

  const handleDrop = async (e: React.DragEvent, day: Date, slot: MealSlot) => {
    e.preventDefault();
    handleDragEnd();
    if (!draggingPlanId) return;
    const plan = plans.find(p => p.id === draggingPlanId);
    if (!plan) return;
    if (plan.planned_date === format(day, 'yyyy-MM-dd') && plan.meal_slot === slot) return;
    const success = await movePlan(draggingPlanId, day, slot);
    if (success) toast.success(`Moved ${plan.title} to ${slot}`);
    else toast.error('Failed to move meal');
  };

  const handleTouchDrop = async (planId: string) => {
    const target = handleTouchEnd();
    if (!target) return;
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    if (plan.planned_date === target.dayStr && plan.meal_slot === target.slot) return;
    const success = await movePlan(planId, target.day, target.slot);
    if (success) toast.success(`Moved ${plan.title} to ${target.slot}`);
    else toast.error('Failed to move meal');
  };

  const handleAddMeal = async (recipeId: string, title: string, image?: string) => {
    if (!addDialog) return;
    const success = await addPlan(recipeId, title, addDialog.date, addDialog.slot, image);
    if (success) {
      await track('meal_added_to_plan', { recipeId, recipeTitle: title });
      toast.success(`Added ${title} to ${addDialog.slot}`);
      setAddDialog(null);
    } else toast.error('Failed to add meal');
  };

  const handleGuidedSelect = async (recipeId: string, title: string, image?: string) => {
    if (!guidedSlot) return;
    const success = await addPlan(recipeId, title, guidedSlot.date, guidedSlot.slot, image);
    if (success) {
      await track('meal_added_to_plan', { recipeId, recipeTitle: title });
      toast.success(`Added ${title} to ${guidedSlot.slot}`);
      setGuidedSlot(null);
    } else toast.error('Failed to add meal');
  };

  const handleAutoGenerate = () => generatePlan(days, plans);

  const handleAcceptDraft = async () => {
    let added = 0;
    for (const meal of draft) {
      const date = new Date(meal.date + 'T00:00:00');
      const success = await addPlan(`custom-${Date.now()}-${added}`, meal.title, date, meal.slot as MealSlot);
      if (success) added++;
    }
    clearDraft();
    toast.success(`Added ${added} meals to your plan`);
  };

  const handleRatingSubmit = async (rating: number, wouldRepeat: boolean) => {
    if (!ratingTarget) return;
    await addRating(ratingTarget.recipeId, ratingTarget.title, rating, wouldRepeat, ratingTarget.slot, ratingTarget.planId);
    toast.success('Rating saved!');
  };

  const handleRemovePlan = async (planId: string, recipeId: string, title: string) => {
    await removePlan(planId);
    await track('meal_removed_from_plan', { recipeId, recipeTitle: title, mealPlanId: planId });
  };

  const handleStatusChange = async (planId: string, recipeId: string, title: string, newStatus: string) => {
    const { error } = await supabase.from('meal_plans').update({ status: newStatus } as any).eq('id', planId);
    if (!error) {
      const eventMap: Record<string, string> = {
        cooked: 'meal_marked_cooked',
        eaten: 'meal_marked_eaten',
        skipped: 'meal_skipped',
      };
      if (eventMap[newStatus]) {
        await track(eventMap[newStatus] as any, { recipeId, recipeTitle: title, mealPlanId: planId });
      }
      await refetchPlans();
      toast.success(newStatus === 'planned' ? 'Reset to planned' : `Marked as ${newStatus}`);
    }
  };

  const editingSettings = editingSlot ? getSlotSettings(editingSlot) : null;

  const emptySlotCount = useMemo(() => {
    let count = 0;
    days.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      MEAL_SLOTS.forEach(slot => {
        if (!plans.find(p => p.planned_date === dayStr && p.meal_slot === slot)) count++;
      });
    });
    return count;
  }, [days, plans]);

  return (
    <div className="p-4 pb-28 max-w-lg mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meal Planner</h1>
          <p className="text-sm text-muted-foreground">Plan your week</p>
        </div>
        <Button
          variant="outline" size="sm"
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
            size="sm" className="rounded-xl text-xs h-8 px-3"
            onClick={() => setWeekOffset(0)}
          >This Week</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Planning Mode Selector */}
      <PlanningModeSelector />

      {/* Profile summary chips */}
      <div className="flex flex-wrap gap-1.5">
        {preferences.dietaryPreferences.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {preferences.dietaryPreferences.join(', ')}
          </span>
        )}
        {preferences.allergies.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
            ⚠ {preferences.allergies.length} allergen{preferences.allergies.length > 1 ? 's' : ''}
          </span>
        )}
        {preferences.preferredCuisines.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground font-medium">
            🌍 {preferences.preferredCuisines.slice(0, 3).join(', ')}{preferences.preferredCuisines.length > 3 ? '…' : ''}
          </span>
        )}
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
          👨‍👩‍👧 {preferences.householdSize} · ⏱ {preferences.cookingTime}
        </span>
      </div>

      {/* Auto-plan section */}
      {isAuto && emptySlotCount > 0 && (
        <div className="glass-card p-4 border-2 border-primary/20 bg-primary/5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Auto-Plan</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {emptySlotCount} empty slot{emptySlotCount > 1 ? 's' : ''} this week. Generate meals based on your preferences, inventory, and past ratings.
          </p>

          {draft.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Draft Plan</p>
              {draft.map((meal, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-20 shrink-0">{meal.date.slice(5)} {meal.slot}</span>
                  <span className="font-medium truncate flex-1">{meal.title}</span>
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 rounded-xl text-xs gap-1" onClick={handleAcceptDraft}>
                  <Check className="w-3.5 h-3.5" /> Accept Plan
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={clearDraft}>
                  Discard
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm" className="rounded-xl text-xs gap-1.5"
              disabled={autoGenerating}
              onClick={handleAutoGenerate}
            >
              {autoGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {autoGenerating ? 'Generating...' : 'Generate Plan'}
            </Button>
          )}
        </div>
      )}

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
            <div key={dayStr} className={`glass-card overflow-hidden ${today ? 'ring-2 ring-primary/30' : ''}`}>
              <div className={`px-4 py-2.5 border-b border-border/40 flex items-center justify-between ${today ? 'bg-primary/5' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${today ? 'text-primary' : ''}`}>{format(day, 'EEE')}</span>
                  <span className="text-xs text-muted-foreground">{format(day, 'MMM d')}</span>
                  {today && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">Today</span>}
                </div>
              </div>

              <div className="p-2 space-y-1.5">
                {MEAL_SLOTS.map(slot => {
                  const plan = dayPlans.find(p => p.meal_slot === slot);
                  const dropKey = `${dayStr}-${slot}`;
                  const isOver = dragOverTarget === dropKey;
                  const existingRating = plan ? getRatingForRecipe(plan.recipe_id) : null;

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
                      <button
                        onClick={() => setEditingSlot(slot)}
                        className="text-xs w-14 shrink-0 text-muted-foreground capitalize flex items-center gap-1 hover:text-primary transition-colors"
                        title="Edit slot settings"
                      >
                        {SLOT_EMOJI[slot]} {slot}
                      </button>
                      {plan ? (
                        <div
                          draggable
                          onDragStart={() => handleDragStart(plan.id)}
                          onDragEnd={handleDragEnd}
                          onTouchStart={e => handleTouchStart(e, plan.id)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={() => handleTouchDrop(plan.id)}
                          className={`flex-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5 border cursor-grab active:cursor-grabbing select-none ${SLOT_COLORS[slot]} ${draggingPlanId === plan.id ? 'opacity-50 scale-95' : ''} ${plan.status === 'eaten' ? 'opacity-60' : ''} ${plan.status === 'skipped' ? 'opacity-40 line-through' : ''} transition-all`}
                        >
                          <GripVertical className="w-3 h-3 shrink-0 opacity-40" />
                          {plan.image && (
                            <img src={plan.image} alt="" className="w-7 h-7 rounded object-cover shrink-0 pointer-events-none" />
                          )}
                          <button
                            className="flex-1 text-left text-xs font-medium truncate hover:underline"
                            onClick={() => {
                              if (plan.recipe_id.startsWith('custom-')) setProductInfoName(plan.title);
                              else navigate(`/recipe/${plan.recipe_id}`);
                            }}
                          >
                            {plan.title}
                          </button>
                          {/* Status actions: cooked / eaten / skipped */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(plan.id, plan.recipe_id, plan.title, plan.status === 'cooked' ? 'planned' : 'cooked'); }}
                              className={`p-0.5 rounded transition-colors ${plan.status === 'cooked' ? 'text-amber-500' : 'hover:bg-foreground/10 text-current opacity-30'}`}
                              title={plan.status === 'cooked' ? 'Undo cooked' : 'Mark cooked'}
                            >
                              <UtensilsCrossed className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(plan.id, plan.recipe_id, plan.title, plan.status === 'eaten' ? 'planned' : 'eaten'); }}
                              className={`p-0.5 rounded transition-colors ${plan.status === 'eaten' ? 'text-green-500' : 'hover:bg-foreground/10 text-current opacity-30'}`}
                              title={plan.status === 'eaten' ? 'Undo eaten' : 'Mark eaten'}
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(plan.id, plan.recipe_id, plan.title, plan.status === 'skipped' ? 'planned' : 'skipped'); }}
                              className={`p-0.5 rounded transition-colors ${plan.status === 'skipped' ? 'text-muted-foreground' : 'hover:bg-foreground/10 text-current opacity-30'}`}
                              title={plan.status === 'skipped' ? 'Undo skip' : 'Mark skipped'}
                            >
                              <SkipForward className="w-3 h-3" />
                            </button>
                          </div>
                          {/* Rating button */}
                          <button
                            onClick={() => setRatingTarget({ recipeId: plan.recipe_id, title: plan.title, slot: plan.meal_slot, planId: plan.id })}
                            className="shrink-0 p-0.5 rounded hover:bg-foreground/10 transition-colors"
                            title={existingRating ? `Rated ${existingRating.rating}★` : 'Rate this meal'}
                          >
                            <Star className={`w-3 h-3 ${existingRating ? 'fill-amber-400 text-amber-400' : 'text-current opacity-40'}`} />
                          </button>
                          <button
                            onClick={() => handleRemovePlan(plan.id, plan.recipe_id, plan.title)}
                            className="shrink-0 p-0.5 rounded hover:bg-foreground/10 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-1.5">
                          <button
                            onClick={() => setAddDialog({ date: day, slot })}
                            className={`flex-1 flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground transition-colors ${isOver ? 'border-primary/40 bg-primary/5' : 'border-border/60 hover:bg-accent/50 hover:border-border'}`}
                          >
                            <Plus className="w-3 h-3" /> {isOver ? 'Drop here' : 'Add meal'}
                          </button>
                          {isGuided && (
                            <button
                              onClick={() => setGuidedSlot({ date: day, slot })}
                              className="shrink-0 p-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                              title="Get suggestions"
                            >
                              <Sparkles className="w-3 h-3 text-primary" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <AddMealDialog addDialog={addDialog} onClose={() => setAddDialog(null)} onAdd={handleAddMeal} favorites={favorites} />
      <ProductInfoDialog productName={productInfoName} onClose={() => setProductInfoName(null)} />
      <SlotSettingsDialog slot={editingSlot} settings={editingSettings} onClose={() => setEditingSlot(null)} onSave={updateSlotSettings} />
      <MealRatingDialog
        open={!!ratingTarget}
        title={ratingTarget?.title || ''}
        onClose={() => setRatingTarget(null)}
        onSubmit={handleRatingSubmit}
      />

      {/* Guided suggestions popup */}
      {guidedSlot && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="w-full max-w-sm glass-card p-4 space-y-3 animate-fade-in rounded-t-2xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {SLOT_EMOJI[guidedSlot.slot]} {guidedSlot.slot} · {format(guidedSlot.date, 'EEE, MMM d')}
              </p>
              <button onClick={() => setGuidedSlot(null)} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <GuidedSuggestions
              slot={guidedSlot.slot}
              date={guidedSlot.date}
              slotSettings={getSlotSettings(guidedSlot.slot)}
              onSelect={handleGuidedSelect}
            />
            <Button variant="outline" size="sm" className="w-full rounded-xl text-xs"
              onClick={() => { setAddDialog({ date: guidedSlot.date, slot: guidedSlot.slot }); setGuidedSlot(null); }}>
              Or add manually
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
