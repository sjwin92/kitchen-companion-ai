import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startOfWeek, addDays, addWeeks, format, isToday } from 'date-fns';
import { useMealPlans, MEAL_SLOTS, type MealPlanKind, type MealSlot } from '@/hooks/useMealPlans';
import { useFavorites } from '@/hooks/useFavorites';
import { useMealDragDrop } from '@/hooks/useMealDragDrop';
import { useMealSlotSettings } from '@/hooks/useMealSlotSettings';
import { useMealRatings } from '@/hooks/useMealRatings';
import { useAutoPlan } from '@/hooks/useAutoPlan';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, X, Loader2, ShoppingCart, GripVertical, Sparkles, UtensilsCrossed, SkipForward, Leaf, MoreHorizontal } from 'lucide-react';
import { useGroceryGenerator } from '@/hooks/useGroceryGenerator';
import AddMealDialog from '@/components/AddMealDialog';
import PlanningModeSelector from '@/components/PlanningModeSelector';
import GuidedSuggestions from '@/components/GuidedSuggestions';
import MealRatingDialog from '@/components/MealRatingDialog';
import { useInteractions } from '@/hooks/useInteractions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/appError';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RecipeArtwork from '@/components/RecipeArtwork';

export default function MealPlanner() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { preferences, inventory } = useApp();
  const [weekOffset, setWeekOffset] = useState(0);
  const [addDialog, setAddDialog] = useState<{ date: Date; slot: MealSlot } | null>(null);
  const [guidedSlot, setGuidedSlot] = useState<{ date: Date; slot: MealSlot } | null>(null);
  const [ratingTarget, setRatingTarget] = useState<{ recipeId: string; title: string; slot: string; planId: string } | null>(null);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return weekOffset === 0 ? base : addWeeks(base, weekOffset);
  }, [weekOffset]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const { plans, loading: plansLoading, error: plansError, addPlan, batchAddPlans, removePlan, movePlan, refetch: refetchPlans } = useMealPlans(weekStart);
  const selectedPlan = plans.find(plan => plan.id === searchParams.get('plan')) ?? null;
  const pendingRecipe = useMemo(() => {
    const recipeId = searchParams.get('recipe');
    const title = searchParams.get('title');
    if (!recipeId || !title) return null;
    const requestedKind = searchParams.get('kind');
    const planKind: MealPlanKind = requestedKind === 'user_recipe' ? 'user_recipe' : 'catalogue';
    return { recipeId, title, image: searchParams.get('image') ?? undefined, planKind };
  }, [searchParams]);
  const { favorites } = useFavorites();
  const { generate, generating } = useGroceryGenerator();
  const { getSlotSettings } = useMealSlotSettings();
  const { fetchRatings, addRating, getRatingForRecipe } = useMealRatings();
  const { track } = useInteractions();
  const { generatePlan, generateSlot, generating: autoGenerating, generatingSlot, draft, clearDraft } = useAutoPlan();
  const {
    draggingPlanId, dragOverTarget,
    handleDragStart, handleDragEnd, handleDragOver, handleDragLeave,
    handleTouchStart, handleTouchMove, handleTouchEnd,
  } = useMealDragDrop();

  useEffect(() => { fetchRatings(); }, [fetchRatings]);

  const isGuided = preferences.planningStyle === 'help-choose';
  const isAuto = preferences.planningStyle === 'do-it-for-me';

  const clearPendingRecipe = () => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      ['recipe', 'title', 'image', 'kind'].forEach(key => next.delete(key));
      return next;
    }, { replace: true });
  };

  const handleEmptySlot = async (date: Date, slot: MealSlot) => {
    if (pendingRecipe) {
      try {
        await addPlan(pendingRecipe.recipeId, pendingRecipe.title, date, slot, pendingRecipe.image, { planKind: pendingRecipe.planKind });
        await track('meal_added_to_plan', { recipeId: pendingRecipe.recipeId, recipeTitle: pendingRecipe.title });
        toast.success(`Added ${pendingRecipe.title} to ${format(date, 'EEEE')} ${slot}`);
        clearPendingRecipe();
      } catch (error) {
        toast.error(errorMessage(error, 'Could not add this recipe to your plan.'));
      }
      return;
    }
    if (isAuto) void handleAutoSlot(date, slot);
    else if (isGuided) setGuidedSlot({ date, slot });
    else setAddDialog({ date, slot });
  };

  // Expiring items for sidebar suggestions
  const expiringItems = inventory.filter(i => i.status === 'use-today' || i.status === 'use-soon');

  // Calculate sustainability score
  const usesInventory = plans.length > 0 ? Math.min(100, Math.round((plans.filter(p => p.planKind === 'inventory' || p.planKind === 'catalogue').length / plans.length) * 100)) : 0;

  const handleDrop = async (e: React.DragEvent, day: Date, slot: MealSlot) => {
    e.preventDefault(); handleDragEnd();
    if (!draggingPlanId) return;
    const plan = plans.find(p => p.id === draggingPlanId);
    if (!plan) return;
    if (plan.planned_date === format(day, 'yyyy-MM-dd') && plan.meal_slot === slot) return;
    try {
      await movePlan(draggingPlanId, day, slot);
      toast.success(`Moved ${plan.title} to ${slot}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to move meal'));
    }
  };

  const handleTouchDrop = async (planId: string) => {
    const target = handleTouchEnd();
    if (!target) return;
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    if (plan.planned_date === target.dayStr && plan.meal_slot === target.slot) return;
    try {
      await movePlan(planId, target.day, target.slot);
      toast.success(`Moved ${plan.title} to ${target.slot}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to move meal'));
    }
  };

  const handleAddMeal = async (
    recipeId: string,
    title: string,
    image?: string,
    options?: { planKind?: MealPlanKind; inventoryItemId?: string | null },
  ) => {
    if (!addDialog) return;
    try {
      await addPlan(recipeId, title, addDialog.date, addDialog.slot, image, options);
      await track('meal_added_to_plan', { recipeId, recipeTitle: title });
      toast.success(`Added ${title}`);
      setAddDialog(null);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to add meal'));
    }
  };

  const handleGuidedSelect = async (recipeId: string, title: string, image?: string) => {
    if (!guidedSlot) return;
    try {
      await addPlan(recipeId, title, guidedSlot.date, guidedSlot.slot, image, { planKind: 'catalogue' });
      await track('meal_added_to_plan', { recipeId, recipeTitle: title });
      toast.success(`Added ${title}`);
      setGuidedSlot(null);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to add meal'));
    }
  };

  const handleAutoGenerate = () => generatePlan(days, plans);

  const handleAutoSlot = useCallback(async (date: Date, slot: MealSlot) => {
    await generateSlot(date, slot, plans, async (meal) => {
      try {
        await addPlan(meal.recipe_id, meal.title, date, slot, meal.image, { planKind: 'catalogue' });
        toast.success(`Added ${meal.title} from your recipe catalogue`);
      } catch (error) {
        toast.error(errorMessage(error, 'Could not add meal'));
      }
    });
  }, [addPlan, generateSlot, plans]);

  const handleAcceptDraft = async () => {
    if (draft.length === 0) return;
    const resolved = draft.map((meal) => ({
      recipeId: meal.recipe_id,
      title: meal.title,
      date: new Date(`${meal.date}T00:00:00`),
      slot: meal.slot as MealSlot,
      image: meal.image,
    }));

    // Single batch insert — much faster than N sequential upserts
    try {
      await batchAddPlans(resolved.map(meal => ({ ...meal, planKind: 'catalogue' as const })));
      clearDraft();
      await refetchPlans();
      toast.success(`Added ${resolved.length} catalogue meals to your plan`);
      toast.info('Use “Build shopping list” to add only the ingredients you are missing.');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save plan — please try again'));
    }
  };

  const handleRatingSubmit = async (rating: number, wouldRepeat: boolean) => {
    if (!ratingTarget) return;
    await addRating(ratingTarget.recipeId, ratingTarget.title, rating, wouldRepeat, ratingTarget.slot, ratingTarget.planId);
    toast.success('Rating saved!');
  };

  const handleRemovePlan = async (planId: string, recipeId: string, title: string) => {
    try {
      await removePlan(planId);
      await track('meal_removed_from_plan', { recipeId, recipeTitle: title, mealPlanId: planId });
      toast.success(`${title} removed`);
      setSearchParams(current => {
        const next = new URLSearchParams(current);
        next.delete('plan');
        return next;
      }, { replace: true });
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to remove meal'));
    }
  };

  const openPlanDetails = (planId: string) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.set('plan', planId);
      return next;
    }, { replace: true });
  };

  const closePlanDetails = () => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.delete('plan');
      return next;
    }, { replace: true });
  };

  const showLunchbox = (preferences.lunchboxCount ?? 0) > 0;
  const DISPLAY_SLOTS: MealSlot[] = showLunchbox
    ? ['breakfast', 'lunch', 'dinner', 'lunchbox']
    : ['breakfast', 'lunch', 'dinner'];
  const emptySlotCount = useMemo(() => {
    let count = 0;
    days.forEach((day, idx) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      DISPLAY_SLOTS.forEach(slot => {
        // Lunchbox only counts on first N weekdays
        if (slot === 'lunchbox') {
          const dow = day.getDay(); // 0=Sun, 6=Sat
          if (dow === 0 || dow === 6) return;
          // Index among weekdays so far
          const weekdayIndex = days.slice(0, idx + 1).filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
          if (weekdayIndex > (preferences.lunchboxCount ?? 0)) return;
        }
        if (!plans.find(p => p.planned_date === dayStr && p.meal_slot === slot)) count++;
      });
    });
    return count;
  }, [days, plans, showLunchbox, preferences.lunchboxCount]);

  const handleSuggestBulkCook = async () => {
    // Find dinners followed by an empty lunch within 1-2 days. Create leftover plans.
    const dinners = plans.filter(p => p.meal_slot === 'dinner').sort((a, b) => a.planned_date.localeCompare(b.planned_date));
    let created = 0;
    const suggestions: { from: typeof dinners[0]; targetDate: Date; targetSlot: MealSlot }[] = [];
    for (const d of dinners) {
      const dDate = new Date(d.planned_date + 'T00:00:00');
      for (let offset = 1; offset <= 2; offset++) {
        const target = addDays(dDate, offset);
        const targetStr = format(target, 'yyyy-MM-dd');
        const lunch = plans.find(p => p.planned_date === targetStr && p.meal_slot === 'lunch');
        if (!lunch && days.some(day => format(day, 'yyyy-MM-dd') === targetStr)) {
          suggestions.push({ from: d, targetDate: target, targetSlot: 'lunch' });
          break;
        }
      }
    }
    if (suggestions.length === 0) {
      toast.info('No empty lunch slots after planned dinners — try planning more dinners first.');
      return;
    }
    // Insert as bulk-cook leftovers
    const rows = suggestions.slice(0, 3).map(s => ({
      recipeId: s.from.recipe_id,
      title: `${s.from.title} (leftovers)`,
      date: s.targetDate,
      slot: s.targetSlot,
      image: s.from.image || undefined,
      planKind: s.from.planKind,
      inventoryItemId: s.from.inventoryItemId,
    }));
    try {
      await batchAddPlans(rows);
      // Mark the original dinners as bulk-cooked
      const updates = await Promise.all(suggestions.slice(0, 3).map(s =>
        supabase.from('meal_plans').update({ bulk_servings: 2 } as any).eq('id', s.from.id)
      ));
      const updateError = updates.find(result => result.error)?.error;
      if (updateError) throw updateError;
      created = rows.length;
      toast.success(`Added ${created} leftover meal${created > 1 ? 's' : ''} — cook double those dinners`);
      await refetchPlans();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to add leftover suggestions'));
    }
  };

  return (
    <div className="p-4 md:px-8 md:py-10 pb-28 md:pb-8 max-w-7xl mx-auto animate-fade-in">
      {plansError && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <span>{plansError}</span>
          <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => void refetchPlans().catch(error => toast.error(errorMessage(error, 'Could not reload meal plan.')))}>Retry</Button>
        </div>
      )}
      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
        {/* Main content */}
        <div>
          {/* Header */}
          <div className="mb-5">
            <p className="section-title mb-2">Weekly Outlook</p>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-display italic leading-tight">
              Meal Planning
            </h1>
          </div>

          {pendingRecipe && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <RecipeArtwork title={pendingRecipe.title} image={pendingRecipe.image} className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Choose an empty slot</p>
                <p className="truncate text-sm font-semibold">Planning {pendingRecipe.title}</p>
              </div>
              <Button variant="ghost" className="min-h-11 rounded-xl" onClick={clearPendingRecipe}>Cancel</Button>
            </div>
          )}

          {/* Planning mode — always visible */}
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-2">Planning style</p>
            <PlanningModeSelector />
            {preferences.planningStyle === 'help-choose' && (
              <p className="text-xs text-muted-foreground mt-2">Tap any empty slot and we'll suggest meals for it.</p>
            )}
            {preferences.planningStyle === 'do-it-for-me' && (
              <p className="text-xs text-muted-foreground mt-2">Tap any empty slot to select a reviewed catalogue recipe, or fill the whole week at once.</p>
            )}
          </div>

          {/* Week nav + actions */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <div className="flex items-center gap-1">
              <Button aria-label="Previous week" variant="ghost" size="icon" className="h-11 w-11" onClick={() => setWeekOffset(w => w - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant={weekOffset === 0 ? 'default' : 'outline'} size="sm" className="min-h-11 rounded-xl px-3 text-xs" onClick={() => setWeekOffset(0)}>
                This Week
              </Button>
              <Button aria-label="Next week" variant="ghost" size="icon" className="h-11 w-11" onClick={() => setWeekOffset(w => w + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {emptySlotCount > 0 && (
              <Button size="sm" className="rounded-xl text-xs gap-1.5 ml-auto" disabled={autoGenerating} onClick={handleAutoGenerate} style={{ background: 'var(--gradient-primary)' }}>
                {autoGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {autoGenerating ? 'Selecting...' : 'Plan from catalogue'}
              </Button>
            )}

            <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5" disabled={generating || plans.length === 0} onClick={() => generate(plans)}>
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
              Grocery List
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5"
              disabled={plans.filter(p => p.meal_slot === 'dinner').length === 0}
              onClick={handleSuggestBulkCook}>
              <UtensilsCrossed className="w-3.5 h-3.5" /> Bulk Cook
            </Button>
          </div>

          {/* Draft plan acceptance */}
          {draft.length > 0 && (
            <div className="glass-card p-4 border-2 border-primary/20 bg-primary/5 space-y-3 mb-5">
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
                <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={clearDraft}>Discard</Button>
              </div>
            </div>
          )}

          {/* Day cards — horizontal grid */}
          <div className="space-y-3" aria-busy={plansLoading}>
            {days.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const today = isToday(day);

              return (
                <div
                  key={dayStr}
                  className={`glass-card overflow-hidden ${today ? 'ring-2 ring-primary/30 bg-primary/3' : ''}`}
                >
                  {/* Day header */}
                  <div className="px-4 py-2.5 flex items-center justify-between border-b border-border/40">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                      {format(day, 'EEEE')}
                    </span>
                    <span className="text-xs text-muted-foreground">{format(day, 'MMM d')}</span>
                  </div>

                  {/* Meal slots row */}
                  <div
                    className="grid divide-x divide-border/30"
                    style={{ gridTemplateColumns: `repeat(${DISPLAY_SLOTS.length}, minmax(0, 1fr))` }}
                  >
                    {DISPLAY_SLOTS.map(slot => {
                      // Hide lunchbox on weekends or past the user's weekly count
                      if (slot === 'lunchbox') {
                        const dow = day.getDay();
                        if (dow === 0 || dow === 6) {
                          return <div key={slot} className="p-3 min-h-[100px] bg-muted/20" />;
                        }
                        const weekdayIndex = days
                          .slice(0, days.indexOf(day) + 1)
                          .filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
                        if (weekdayIndex > (preferences.lunchboxCount ?? 0)) {
                          return <div key={slot} className="p-3 min-h-[100px] bg-muted/20" />;
                        }
                      }
                      const plan = plans.find(p => p.planned_date === dayStr && p.meal_slot === slot);
                      const slotLabel = slot === 'lunchbox' ? 'Lunchbox' : slot.charAt(0).toUpperCase() + slot.slice(1);
                      const AddIcon = isAuto ? Sparkles : Plus;
                      const addLabel = isAuto ? 'Auto' : 'Add';
                      const addBtn = (
                        <button
                          onClick={() => void handleEmptySlot(day, slot as MealSlot)}
                          className="flex-1 flex flex-col items-center justify-center border border-dashed border-border/60 rounded-lg hover:bg-muted/30 transition-colors"
                          disabled={generatingSlot === `${format(day, 'yyyy-MM-dd')}-${slot}`}
                        >
                          {generatingSlot === `${format(day, 'yyyy-MM-dd')}-${slot}`
                            ? <Loader2 className="w-4 h-4 text-muted-foreground mb-0.5 animate-spin" />
                            : <AddIcon className="w-4 h-4 text-muted-foreground mb-0.5" />}
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                            {generatingSlot === `${format(day, 'yyyy-MM-dd')}-${slot}` ? 'Selecting' : addLabel}
                          </span>
                        </button>
                      );

                      return (
                        <div
                          key={slot}
                          className="p-3 min-h-[100px] flex flex-col"
                          onDragOver={e => { e.preventDefault(); handleDragOver(e, dayStr, slot as MealSlot); }}
                          onDragLeave={handleDragLeave}
                          onDrop={e => handleDrop(e, day, slot as MealSlot)}
                        >
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{slotLabel}</p>
                          {plan ? (
                            <div className="flex-1 flex flex-col">
                              {plan.image && (
                                <img
                                  src={plan.image}
                                  alt=""
                                  className="w-full h-14 rounded-lg object-cover mb-1.5 cursor-pointer"
                                  onClick={() => openPlanDetails(plan.id)}
                                />
                              )}
                              <p className="text-xs font-semibold leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                                onClick={() => openPlanDetails(plan.id)}>
                                {plan.title}
                              </p>
                              {plan.status !== 'planned' && (
                                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded mt-1 w-fit ${
                                  plan.status === 'eaten' ? 'bg-primary/10 text-primary' :
                                  plan.status === 'cooked' ? 'bg-amber-500/10 text-amber-600' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {plan.status}
                                </span>
                              )}
                              <div className="mt-auto flex justify-end pt-1.5">
                                <button aria-label={`Open actions for ${plan.title}`} onClick={() => openPlanDetails(plan.id)} className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </div>
                            </div>
                          ) : addBtn}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5 hidden md:block">
          {/* Expiring Soon */}
          {expiringItems.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="section-title mb-3">Expiring Soon</h3>
              <p className="text-sm leading-relaxed">
                Use your{' '}
                {expiringItems.slice(0, 2).map((item, i) => (
                  <span key={item.id}>
                    {i > 0 && ' and '}
                    <strong>{item.name.toLowerCase()}</strong>
                  </span>
                ))}
                {' '}for an upcoming dinner.
              </p>
              <button
                onClick={() => navigate('/meals')}
                className="text-[10px] font-bold uppercase tracking-wider text-primary mt-3 flex items-center gap-1 hover:gap-2 transition-all"
              >
                Suggest Recipe <span>→</span>
              </button>
            </div>
          )}

          {/* Pantry Optimization */}
          <div className="glass-card p-5">
            <h3 className="section-title mb-3">Pantry Optimization</h3>
            <p className="text-sm leading-relaxed">
              You have <strong>{inventory.length} items</strong> in your pantry. Plan meals that use what you already have.
            </p>
          </div>

          {/* Sustainability Score */}
          <div className="glass-card p-5">
            <h3 className="section-title mb-3">Sustainability Score</h3>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-4xl font-extrabold">{plans.length > 0 ? Math.round(72 + usesInventory * 0.28) : 0}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-high overflow-hidden mb-3">
              <div className="h-full rounded-full bg-primary/60 transition-all duration-500" style={{ width: `${plans.length > 0 ? Math.round(72 + usesInventory * 0.28) : 0}%` }} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your plan uses {usesInventory}% of current inventory, reducing potential waste.
            </p>
          </div>

        </div>
      </div>

      <AddMealDialog addDialog={addDialog} onClose={() => setAddDialog(null)} onAdd={handleAddMeal} favorites={favorites} />
      <MealRatingDialog open={!!ratingTarget} title={ratingTarget?.title || ''} onClose={() => setRatingTarget(null)} onSubmit={handleRatingSubmit} />

      <Dialog open={!!selectedPlan} onOpenChange={open => { if (!open) closePlanDetails(); }}>
        <DialogContent className="max-w-md overflow-hidden rounded-[1.75rem] p-0">
          {selectedPlan && (
            <>
              <RecipeArtwork title={selectedPlan.title} image={selectedPlan.image ?? undefined} className="h-52 w-full" />
              <div className="space-y-5 p-6 pt-4">
                <DialogHeader>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{selectedPlan.meal_slot} · {selectedPlan.planned_date}</p>
                  <DialogTitle className="text-2xl tracking-tight">{selectedPlan.title}</DialogTitle>
                  <DialogDescription>
                    {selectedPlan.planKind === 'inventory'
                      ? 'Planned directly from your kitchen inventory.'
                      : selectedPlan.planKind === 'custom'
                        ? 'A custom meal in your weekly plan.'
                        : 'A recipe from your trusted catalogue.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-2">
                  {(selectedPlan.planKind === 'catalogue' || selectedPlan.planKind === 'user_recipe') && (
                    <Button className="min-h-11 rounded-xl" onClick={() => navigate(`/recipe/${selectedPlan.recipe_id}`)}>Open recipe</Button>
                  )}
                  <Button className="min-h-11 rounded-xl" variant="outline" onClick={() => navigate('/meal-log', { state: { plannedMeal: { planId: selectedPlan.id, recipeId: selectedPlan.recipe_id, title: selectedPlan.title } } })}>Record meal</Button>
                  <Button className="min-h-11 rounded-xl" variant="outline" onClick={() => setRatingTarget({ recipeId: selectedPlan.recipe_id, title: selectedPlan.title, slot: selectedPlan.meal_slot, planId: selectedPlan.id })}>Rate meal</Button>
                  <Button className="min-h-11 rounded-xl text-destructive" variant="outline" onClick={() => void handleRemovePlan(selectedPlan.id, selectedPlan.recipe_id, selectedPlan.title)}>Remove</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {guidedSlot && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="w-full max-w-sm glass-card p-4 space-y-3 animate-fade-in rounded-t-2xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{guidedSlot.slot} · {format(guidedSlot.date, 'EEE, MMM d')}</p>
              <button aria-label="Close guided suggestions" onClick={() => setGuidedSlot(null)} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <GuidedSuggestions slot={guidedSlot.slot} date={guidedSlot.date} slotSettings={getSlotSettings(guidedSlot.slot)} onSelect={handleGuidedSelect} />
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
