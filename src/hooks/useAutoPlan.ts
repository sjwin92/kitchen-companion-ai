import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useApp } from '@/context/AppContext';
import type { MealPlan, MealSlot } from './useMealPlans';
import { listRecommendedCatalogRecipes } from '@/services/betaCatalog';
import type { RecipeRecommendation } from '@/types';

const DRAFT_KEY_PREFIX = 'mealplan-draft';

export interface PlannedCatalogMeal {
  date: string;
  slot: string;
  recipe_id: string;
  title: string;
  search_term: string;
  image?: string;
}

export function mealPlanDraftKey(userId: string) {
  return `${DRAFT_KEY_PREFIX}:${userId}`;
}

function loadDraftFromStorage(userId?: string): PlannedCatalogMeal[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(mealPlanDraftKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function slotMatches(recommendation: RecipeRecommendation, slot: string) {
  const target = slot === 'lunchbox' ? 'lunch' : slot;
  return recommendation.recipe.mealTypes.includes(slot)
    || recommendation.recipe.mealTypes.includes(target);
}

export function useAutoPlan() {
  const { session, preferences } = useApp();
  const userId = session?.user.id;
  const [generating, setGenerating] = useState(false);
  const [generatingSlot, setGeneratingSlot] = useState<string | null>(null);
  const [draft, setDraftState] = useState<PlannedCatalogMeal[]>(() => loadDraftFromStorage(userId));

  useEffect(() => {
    localStorage.removeItem(DRAFT_KEY_PREFIX);
    setDraftState(loadDraftFromStorage(userId));
  }, [userId]);

  const setDraft = useCallback((meals: PlannedCatalogMeal[]) => {
    setDraftState(meals);
    if (!userId) return;
    if (meals.length > 0) localStorage.setItem(mealPlanDraftKey(userId), JSON.stringify(meals));
    else localStorage.removeItem(mealPlanDraftKey(userId));
  }, [userId]);

  const clearDraft = useCallback(() => {
    setDraftState([]);
    if (userId) localStorage.removeItem(mealPlanDraftKey(userId));
  }, [userId]);

  const rankCatalogue = useCallback(async () => {
    if (!session?.user) return [];
    return listRecommendedCatalogRecipes({ limit: 100 });
  }, [session?.user]);

  const generatePlan = useCallback(async (days: Date[], existingPlans: MealPlan[]) => {
    if (!session?.user) {
      toast.error('Please sign in first');
      return [];
    }

    const displaySlots: MealSlot[] = (preferences.lunchboxCount ?? 0) > 0
      ? ['breakfast', 'lunch', 'dinner', 'lunchbox']
      : ['breakfast', 'lunch', 'dinner'];
    const emptySlots: Array<{ date: string; slot: MealSlot }> = [];
    days.forEach((day, dayIndex) => {
      const date = format(day, 'yyyy-MM-dd');
      displaySlots.forEach((slot) => {
        if (slot === 'lunchbox') {
          if (day.getDay() === 0 || day.getDay() === 6) return;
          const weekdayIndex = days
            .slice(0, dayIndex + 1)
            .filter((candidate) => candidate.getDay() !== 0 && candidate.getDay() !== 6).length;
          if (weekdayIndex > (preferences.lunchboxCount ?? 0)) return;
        }
        if (!existingPlans.some((plan) => plan.planned_date === date && plan.meal_slot === slot)) {
          emptySlots.push({ date, slot });
        }
      });
    });

    if (emptySlots.length === 0) {
      toast.info('All slots are already filled!');
      return [];
    }

    setGenerating(true);
    try {
      const ranked = await rankCatalogue();
      if (ranked.length === 0) {
        toast.error('No reviewed catalogue recipes are available for this profile yet.');
        return [];
      }

      const usedIds = new Set(
        existingPlans.map((plan) => plan.recipe_id).filter((id) => ranked.some((item) => item.recipe.id === id)),
      );
      const usedTitles = new Set(existingPlans.map((plan) => plan.title.toLowerCase()));
      const meals = emptySlots.map(({ date, slot }) => {
        const unused = ranked.filter((item) => !usedIds.has(item.recipe.id) && !usedTitles.has(item.recipe.title.toLowerCase()));
        const matching = unused.filter((item) => slotMatches(item, slot));
        const recommendation = matching[0] ?? unused[0] ?? ranked.find((item) => slotMatches(item, slot)) ?? ranked[0];
        usedIds.add(recommendation.recipe.id);
        usedTitles.add(recommendation.recipe.title.toLowerCase());
        return {
          date,
          slot,
          recipe_id: recommendation.recipe.id,
          title: recommendation.recipe.title,
          search_term: recommendation.recipe.title,
          image: recommendation.recipe.imagePath ?? undefined,
        };
      });

      setDraft(meals);
      toast.success(`Selected ${meals.length} reviewed recipe${meals.length === 1 ? '' : 's'} from your catalogue`);
      return meals;
    } catch (error) {
      console.error('Failed to build catalogue meal plan', error);
      toast.error('Could not build a plan from the recipe catalogue.');
      return [];
    } finally {
      setGenerating(false);
    }
  }, [preferences.lunchboxCount, rankCatalogue, session?.user, setDraft]);

  const generateSlot = useCallback(async (
    date: Date,
    slot: MealSlot,
    existingPlans: MealPlan[],
    onAdd: (meal: PlannedCatalogMeal) => Promise<void>,
  ) => {
    if (!session?.user) {
      toast.error('Please sign in first');
      return;
    }

    const slotKey = `${format(date, 'yyyy-MM-dd')}-${slot}`;
    setGeneratingSlot(slotKey);
    try {
      const ranked = await rankCatalogue();
      const existingTitles = new Set(existingPlans.map((plan) => plan.title.toLowerCase()));
      const unused = ranked.filter((item) => !existingTitles.has(item.recipe.title.toLowerCase()));
      const recommendation = unused.find((item) => slotMatches(item, slot))
        ?? unused[0]
        ?? ranked.find((item) => slotMatches(item, slot))
        ?? ranked[0];
      if (!recommendation) {
        toast.error('No reviewed catalogue recipe is available for this slot yet.');
        return;
      }
      await onAdd({
        date: format(date, 'yyyy-MM-dd'),
        slot,
        recipe_id: recommendation.recipe.id,
        title: recommendation.recipe.title,
        search_term: recommendation.recipe.title,
        image: recommendation.recipe.imagePath ?? undefined,
      });
    } catch (error) {
      console.error('Failed to select catalogue recipe', error);
      toast.error('Could not select a catalogue recipe.');
    } finally {
      setGeneratingSlot(null);
    }
  }, [rankCatalogue, session?.user]);

  return { generatePlan, generateSlot, generating, generatingSlot, draft, clearDraft };
}
