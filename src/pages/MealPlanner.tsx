import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { startOfWeek, addDays, addWeeks, format, isToday } from 'date-fns';
import { useMealPlans, MEAL_SLOTS, type MealSlot } from '@/hooks/useMealPlans';
import { useFavorites } from '@/hooks/useFavorites';
import { useMealDragDrop } from '@/hooks/useMealDragDrop';
import { useMealSlotSettings } from '@/hooks/useMealSlotSettings';
import { useMealRatings } from '@/hooks/useMealRatings';
import { useAutoPlan } from '@/hooks/useAutoPlan';
import { useMealLibrary } from '@/hooks/useMealLibrary';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, X, Loader2, ShoppingCart, GripVertical, Sparkles, Star, Check, UtensilsCrossed, SkipForward, Leaf } from 'lucide-react';
import { useGroceryGenerator } from '@/hooks/useGroceryGenerator';
import AddMealDialog from '@/components/AddMealDialog';
import ProductInfoDialog from '@/components/ProductInfoDialog';
import PlanningModeSelector from '@/components/PlanningModeSelector';
import SlotSettingsDialog from '@/components/SlotSettingsDialog';
import GuidedSuggestions from '@/components/GuidedSuggestions';
import MealRatingDialog from '@/components/MealRatingDialog';
import { useInteractions } from '@/hooks/useInteractions';
import { supabase } from '@/integrations/supabase/client';
import { searchRecipes } from '@/services/recipes/recipeProvider';
import { toast } from 'sonner';

export default function MealPlanner() {
  const navigate = useNavigate();
  const { preferences, inventory } = useApp();
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
  const { saveMeal, saveBatch, trackSignal, fetchLibrary } = useMealLibrary();
  const {
    draggingPlanId, dragOverTarget,
    handleDragStart, handleDragEnd, handleDragOver, handleDragLeave,
    handleTouchStart, handleTouchMove, handleTouchEnd,
  } = useMealDragDrop();

  useEffect(() => { fetchRatings(); }, [fetchRatings]);

  const isGuided = preferences.planningStyle === 'help-choose';
  const isAuto = preferences.planningStyle === 'do-it-for-me';

  // Expiring items for sidebar suggestions
  const expiringItems = inventory.filter(i => i.status === 'use-today' || i.status === 'use-soon');

  // Calculate sustainability score
  const planRecipeIds = plans.map(p => p.recipe_id);
  const usesInventory = plans.length > 0 ? Math.min(100, Math.round((plans.filter(p => !p.recipe_id.startsWith('custom-')).length / plans.length) * 100)) : 0;

  const handleDrop = async (e: React.DragEvent, day: Date, slot: MealSlot) => {
    e.preventDefault(); handleDragEnd();
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
      // Persist to meal library
      const entry = await saveMeal({
        title, image, external_recipe_id: recipeId, source: 'external',
        generation_context: { added_via: 'manual', slot: addDialog.slot },
      });
      if (entry) await trackSignal(entry.id, 'planned');
      toast.success(`Added ${title}`);
      setAddDialog(null);
    } else toast.error('Failed to add meal');
  };

  const handleGuidedSelect = async (recipeId: string, title: string, image?: string) => {
    if (!guidedSlot) return;
    const success = await addPlan(recipeId, title, guidedSlot.date, guidedSlot.slot, image);
    if (success) {
      await track('meal_added_to_plan', { recipeId, recipeTitle: title });
      const entry = await saveMeal({
        title, image, external_recipe_id: recipeId, source: 'external',
        generation_context: { added_via: 'guided', slot: guidedSlot.slot },
      });
      if (entry) await trackSignal(entry.id, 'planned');
      toast.success(`Added ${title}`);
      setGuidedSlot(null);
    } else toast.error('Failed to add meal');
  };

  const handleAutoGenerate = () => generatePlan(days, plans);

  const handleAcceptDraft = async () => {
    let added = 0;
    const newPlans: typeof plans = [];
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    for (const meal of draft) {
      const date = new Date(meal.date + 'T00:00:00');
      let recipeId = `custom-${Date.now()}-${added}`;
      let image: string | undefined;
      if (meal.search_term) {
        try {
          const url = `https://${projectId}.supabase.co/functions/v1/mealdb-proxy?path=${encodeURIComponent(`search.php?s=${meal.search_term}`)}`;
          const res = await fetch(url, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
          const data = await res.json();
          const match = data?.meals?.[0];
          if (match) { recipeId = `mealdb-${match.idMeal}`; image = match.strMealThumb; }
        } catch { /* fallback */ }
      }
      const success = await addPlan(recipeId, meal.title, date, meal.slot as MealSlot, image);
      if (success) {
        added++;
        newPlans.push({ id: '', recipe_id: recipeId, title: meal.title, planned_date: meal.date, meal_slot: meal.slot, image: image ?? null, status: 'planned', created_at: '' });
      }
    }
    // Batch-save generated meals to library
    const libraryInserts = draft.map(meal => ({
      title: meal.title,
      source: 'generated' as const,
      generation_context: { search_term: meal.search_term, slot: meal.slot, date: meal.date },
    }));
    await saveBatch(libraryInserts);

    clearDraft();
    toast.success(`Added ${added} meals`);
    if (added > 0) {
      const allPlans = [...plans, ...newPlans];
      const mealDbPlans = allPlans.filter(p => p.recipe_id.startsWith('mealdb-'));
      if (mealDbPlans.length > 0) { toast.info('Checking pantry…'); await generate(mealDbPlans); }
    }
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
      const eventMap: Record<string, string> = { cooked: 'meal_marked_cooked', eaten: 'meal_marked_eaten', skipped: 'meal_skipped' };
      if (eventMap[newStatus]) await track(eventMap[newStatus] as any, { recipeId, recipeTitle: title, mealPlanId: planId });
      await refetchPlans();
      toast.success(newStatus === 'planned' ? 'Reset' : `Marked as ${newStatus}`);
    }
  };

  const editingSettings = editingSlot ? getSlotSettings(editingSlot) : null;
  const emptySlotCount = useMemo(() => {
    let count = 0;
    days.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      MEAL_SLOTS.forEach(slot => { if (!plans.find(p => p.planned_date === dayStr && p.meal_slot === slot)) count++; });
    });
    return count;
  }, [days, plans]);

  return (
    <div className="p-4 md:px-8 md:py-10 pb-28 md:pb-8 max-w-7xl mx-auto animate-fade-in">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
        {/* Main content */}
        <div>
          {/* Editorial header */}
          <div className="mb-6">
            <p className="section-title mb-2">Weekly Outlook</p>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-display italic leading-tight">
              Meal Planning
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-lg leading-relaxed">
              Organize your culinary week with architectural precision. Use existing ingredients to minimize waste and ensure every meal is intentional.
            </p>
          </div>

          {/* Week nav + actions */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant={weekOffset === 0 ? 'default' : 'outline'} size="sm" className="rounded-xl text-xs h-8 px-3" onClick={() => setWeekOffset(0)}>
                This Week
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {emptySlotCount > 0 && (
              <Button size="sm" className="rounded-xl text-xs gap-1.5 ml-auto" disabled={autoGenerating} onClick={handleAutoGenerate} style={{ background: 'var(--gradient-primary)' }}>
                {autoGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {autoGenerating ? 'Generating...' : 'Auto-Plan'}
              </Button>
            )}

            <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5" disabled={generating || plans.length === 0} onClick={() => generate(plans)}>
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
              Grocery List
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

          {loading && <div className="glass-card p-6 text-center text-sm text-muted-foreground shimmer">Loading…</div>}

          {/* Day cards — horizontal grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {days.map(day => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayPlans = plans.filter(p => p.planned_date === dayStr);
              const today = isToday(day);
              const hasPlan = dayPlans.length > 0;
              const dinnerPlan = dayPlans.find(p => p.meal_slot === 'dinner') || dayPlans[0];

              return (
                <div
                  key={dayStr}
                  className={`glass-card overflow-hidden flex flex-col ${today ? 'ring-2 ring-primary/30 bg-primary/3' : ''}`}
                >
                  {/* Day header */}
                  <div className="px-3 py-2.5 flex items-center justify-between border-b border-border/40">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                      {format(day, 'EEEE')}
                    </span>
                    <span className="text-xs text-muted-foreground">{format(day, 'MMM d')}</span>
                  </div>

                  {/* Content */}
                  <div className="p-3 flex-1 flex flex-col justify-end min-h-[120px]">
                    {hasPlan && dinnerPlan ? (
                      <>
                        {dinnerPlan.image && (
                          <img src={dinnerPlan.image} alt="" className="w-16 h-16 rounded-lg object-cover mb-2" />
                        )}
                        <h4 className="text-sm font-bold leading-tight">{dinnerPlan.title}</h4>
                        {dayPlans.length > 1 && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            +{dayPlans.length - 1} more meal{dayPlans.length > 2 ? 's' : ''}
                          </p>
                        )}

                        {/* Status & actions */}
                        <div className="flex items-center gap-1 mt-2">
                          {dinnerPlan.status !== 'planned' && (
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              dinnerPlan.status === 'eaten' ? 'bg-success/10 text-success' :
                              dinnerPlan.status === 'cooked' ? 'bg-warning/10 text-warning' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {dinnerPlan.status}
                            </span>
                          )}
                          <button onClick={() => handleRemovePlan(dinnerPlan.id, dinnerPlan.recipe_id, dinnerPlan.title)} className="p-0.5 rounded hover:bg-foreground/10 ml-auto">
                            <X className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => setAddDialog({ date: day, slot: 'dinner' })}
                        className="flex flex-col items-center justify-center flex-1 border border-dashed border-border/60 rounded-lg hover:bg-surface-low/50 transition-colors"
                      >
                        <Plus className="w-5 h-5 text-muted-foreground mb-1" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {isGuided ? 'Gap Identified' : 'Plan Dinner'}
                        </span>
                      </button>
                    )}
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

          <PlanningModeSelector />
        </div>
      </div>

      <AddMealDialog addDialog={addDialog} onClose={() => setAddDialog(null)} onAdd={handleAddMeal} favorites={favorites} />
      <ProductInfoDialog productName={productInfoName} onClose={() => setProductInfoName(null)} includeRecipe />
      <SlotSettingsDialog slot={editingSlot} settings={editingSettings} onClose={() => setEditingSlot(null)} onSave={updateSlotSettings} />
      <MealRatingDialog open={!!ratingTarget} title={ratingTarget?.title || ''} onClose={() => setRatingTarget(null)} onSubmit={handleRatingSubmit} />

      {guidedSlot && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end justify-center p-4">
          <div className="w-full max-w-sm glass-card p-4 space-y-3 animate-fade-in rounded-t-2xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{guidedSlot.slot} · {format(guidedSlot.date, 'EEE, MMM d')}</p>
              <button onClick={() => setGuidedSlot(null)} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
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
