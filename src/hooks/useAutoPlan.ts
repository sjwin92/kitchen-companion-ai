import { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useMealSlotSettings } from './useMealSlotSettings';
import { useMealRatings } from './useMealRatings';
import type { MealPlan, MealSlot } from './useMealPlans';
import { format, startOfMonth, endOfMonth, differenceInCalendarDays } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const DRAFT_KEY = 'mealplan-draft';

interface GeneratedMeal {
  date: string;
  slot: string;
  title: string;
  search_term: string;
  image?: string;
}

function loadDraftFromStorage(): GeneratedMeal[] {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useAutoPlan() {
  const { session, preferences, inventory } = useApp();
  const { settings: slotSettings } = useMealSlotSettings();
  const { ratings } = useMealRatings();
  const [generating, setGenerating] = useState(false);
  const [generatingSlot, setGeneratingSlot] = useState<string | null>(null);
  // Draft persists to localStorage so navigating away and back doesn't lose it
  const [draft, setDraftState] = useState<GeneratedMeal[]>(loadDraftFromStorage);

  const setDraft = useCallback((meals: GeneratedMeal[]) => {
    setDraftState(meals);
    if (meals.length > 0) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(meals));
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  const clearDraft = useCallback(() => {
    setDraftState([]);
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  const computeBudget = useCallback(async () => {
    if (!preferences.monthlyBudgetGbp || !session?.user) return null;
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const { data } = await supabase
      .from('receipt_reconciliations')
      .select('total_gbp')
      .eq('user_id', session.user.id)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());
    const spent = (data || []).reduce((s: number, r: any) => s + Number(r.total_gbp || 0), 0);
    const remaining = Math.max(0, preferences.monthlyBudgetGbp - spent);
    const daysLeft = Math.max(1, differenceInCalendarDays(end, now) + 1);
    const weeklyCapGbp = (remaining / daysLeft) * 7;
    return { weeklyCapGbp, monthlyBudget: preferences.monthlyBudgetGbp, monthSpent: spent };
  }, [preferences.monthlyBudgetGbp, session?.user?.id]);

  const buildRequestBody = useCallback((
    slots: { date: string; slot: string }[],
    existingPlans: MealPlan[],
    budget: { weeklyCapGbp: number; monthlyBudget: number; monthSpent: number } | null,
  ) => ({
    slots,
    profile: {
      householdSize: preferences.householdSize,
      dietaryPreferences: preferences.dietaryPreferences,
      allergies: preferences.allergies,
      dislikedIngredients: preferences.dislikedIngredients,
      preferredCuisines: preferences.preferredCuisines,
      cookingTime: preferences.cookingTime,
      cookingConfidence: preferences.cookingConfidence,
      budgetSensitivity: preferences.budgetSensitivity,
      primaryGoal: preferences.primaryGoal,
    },
    slotSettings: slotSettings.map(s => ({
      slot: s.slot,
      target_prep_time: s.target_prep_time,
      complexity: s.complexity,
      cuisine_preference: s.cuisine_preference,
      quick_bias: s.quick_bias,
      family_friendly_bias: s.family_friendly_bias,
      pantry_first_bias: s.pantry_first_bias,
      budget_friendly_bias: s.budget_friendly_bias,
    })),
    inventory: inventory.map(i => ({ name: i.name })),
    existingPlans: existingPlans.map(p => ({ title: p.title, slot: p.meal_slot })),
    ratings: ratings.slice(0, 30).map(r => ({
      title: r.title,
      rating: r.rating,
      would_repeat: r.would_repeat,
    })),
    budget,
  }), [preferences, slotSettings, inventory, ratings]);

  const callGeneratePlan = useCallback(async (body: object): Promise<GeneratedMeal[]> => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/generate-plan`,
      {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed: ${res.status}`);
    }

    const data = await res.json();
    return data.meals || [];
  }, []);

  /** Fill all empty slots for the week — shows a draft for user to accept */
  const generatePlan = useCallback(async (
    days: Date[],
    existingPlans: MealPlan[],
  ) => {
    if (!session?.user) { toast.error('Please sign in first'); return []; }

    const displaySlots: MealSlot[] = (preferences.lunchboxCount ?? 0) > 0
      ? ['breakfast', 'lunch', 'dinner', 'lunchbox']
      : ['breakfast', 'lunch', 'dinner'];
    const emptySlots: { date: string; slot: string }[] = [];
    days.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      displaySlots.forEach(slot => {
        if (slot === 'lunchbox') {
          const dow = day.getDay();
          if (dow === 0 || dow === 6) return;
          const weekdayIndex = days
            .slice(0, days.indexOf(day) + 1)
            .filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
          if (weekdayIndex > (preferences.lunchboxCount ?? 0)) return;
        }
        if (!existingPlans.find(p => p.planned_date === dayStr && p.meal_slot === slot)) {
          emptySlots.push({ date: dayStr, slot });
        }
      });
    });

    if (emptySlots.length === 0) { toast.info('All slots are already filled!'); return []; }

    setGenerating(true);
    try {
      const budget = await computeBudget();
      const meals = await callGeneratePlan(buildRequestBody(emptySlots, existingPlans, budget));
      setDraft(meals);
      toast.success(`Generated ${meals.length} meal suggestion${meals.length !== 1 ? 's' : ''}${budget ? ` · within £${budget.weeklyCapGbp.toFixed(0)} cap` : ''}`);
      return meals;
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to generate plan');
      return [];
    } finally {
      setGenerating(false);
    }
  }, [session, buildRequestBody, callGeneratePlan, setDraft, preferences.lunchboxCount, computeBudget]);

  /** Auto-fill a single slot immediately — no draft, calls onAdd directly */
  const generateSlot = useCallback(async (
    date: Date,
    slot: MealSlot,
    existingPlans: MealPlan[],
    onAdd: (meal: GeneratedMeal) => Promise<void>,
  ) => {
    if (!session?.user) { toast.error('Please sign in first'); return; }

    const slotKey = `${format(date, 'yyyy-MM-dd')}-${slot}`;
    setGeneratingSlot(slotKey);
    try {
      const budget = await computeBudget();
      const meals = await callGeneratePlan(
        buildRequestBody([{ date: format(date, 'yyyy-MM-dd'), slot }], existingPlans, budget)
      );
      if (meals.length > 0) {
        await onAdd(meals[0]);
      } else {
        toast.error('Could not generate a suggestion');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to generate suggestion');
    } finally {
      setGeneratingSlot(null);
    }
  }, [session, buildRequestBody, callGeneratePlan, computeBudget]);

  return { generatePlan, generateSlot, generating, generatingSlot, draft, clearDraft };
}
