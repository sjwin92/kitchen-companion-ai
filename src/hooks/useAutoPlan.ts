import { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useMealSlotSettings } from './useMealSlotSettings';
import { useMealRatings } from './useMealRatings';
import type { MealPlan, MealSlot } from './useMealPlans';
import { format } from 'date-fns';
import { toast } from 'sonner';

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

  const buildRequestBody = useCallback((
    slots: { date: string; slot: string }[],
    existingPlans: MealPlan[],
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

    const displaySlots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
    const emptySlots: { date: string; slot: string }[] = [];
    days.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      displaySlots.forEach(slot => {
        if (!existingPlans.find(p => p.planned_date === dayStr && p.meal_slot === slot)) {
          emptySlots.push({ date: dayStr, slot });
        }
      });
    });

    if (emptySlots.length === 0) { toast.info('All slots are already filled!'); return []; }

    setGenerating(true);
    try {
      const meals = await callGeneratePlan(buildRequestBody(emptySlots, existingPlans));
      setDraft(meals);
      toast.success(`Generated ${meals.length} meal suggestion${meals.length !== 1 ? 's' : ''}`);
      return meals;
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to generate plan');
      return [];
    } finally {
      setGenerating(false);
    }
  }, [session, buildRequestBody, callGeneratePlan, setDraft]);

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
      const meals = await callGeneratePlan(
        buildRequestBody([{ date: format(date, 'yyyy-MM-dd'), slot }], existingPlans)
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
  }, [session, buildRequestBody, callGeneratePlan]);

  return { generatePlan, generateSlot, generating, generatingSlot, draft, clearDraft };
}
