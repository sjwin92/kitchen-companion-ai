import { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useMealSlotSettings } from './useMealSlotSettings';
import { useMealRatings } from './useMealRatings';
import type { MealPlan, MealSlot } from './useMealPlans';
import { MEAL_SLOTS } from './useMealPlans';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface GeneratedMeal {
  date: string;
  slot: string;
  title: string;
  search_term: string;
  image?: string;
}

export function useAutoPlan() {
  const { session, preferences, inventory } = useApp();
  const { settings: slotSettings } = useMealSlotSettings();
  const { ratings } = useMealRatings();
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<GeneratedMeal[]>([]);

  const generatePlan = useCallback(async (
    days: Date[],
    existingPlans: MealPlan[],
  ) => {
    if (!session?.user) {
      toast.error('Please sign in first');
      return [];
    }

    // Find empty slots
    const emptySlots: { date: string; slot: string }[] = [];
    const displaySlots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
    days.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      displaySlots.forEach(slot => {
        if (!existingPlans.find(p => p.planned_date === dayStr && p.meal_slot === slot)) {
          emptySlots.push({ date: dayStr, slot });
        }
      });
    });

    if (emptySlots.length === 0) {
      toast.info('All slots are already filled!');
      return [];
    }

    setGenerating(true);
    try {
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
          body: JSON.stringify({
            slots: emptySlots,
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
          }),
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed: ${res.status}`);
      }

      const data = await res.json();
      const meals: GeneratedMeal[] = data.meals || [];
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
  }, [session, preferences, inventory, slotSettings, ratings]);

  const clearDraft = useCallback(() => setDraft([]), []);

  return { generatePlan, generating, draft, clearDraft };
}
