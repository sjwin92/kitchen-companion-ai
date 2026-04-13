import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';

export type FeedbackType =
  | 'loved_it'
  | 'too_complicated'
  | 'took_too_long'
  | 'too_many_missing'
  | 'too_expensive'
  | 'too_high_calorie'
  | 'not_filling'
  | 'family_liked'
  | 'family_disliked';

export const FEEDBACK_OPTIONS: { type: FeedbackType; label: string; emoji: string; positive: boolean }[] = [
  { type: 'loved_it', label: 'Loved it', emoji: '❤️', positive: true },
  { type: 'family_liked', label: 'Family liked it', emoji: '👨‍👩‍👧', positive: true },
  { type: 'too_complicated', label: 'Too complicated', emoji: '😵', positive: false },
  { type: 'took_too_long', label: 'Took too long', emoji: '⏰', positive: false },
  { type: 'too_many_missing', label: 'Too many missing ingredients', emoji: '🛒', positive: false },
  { type: 'too_expensive', label: 'Too expensive', emoji: '💸', positive: false },
  { type: 'too_high_calorie', label: 'Too high calorie', emoji: '🔥', positive: false },
  { type: 'not_filling', label: 'Not filling enough', emoji: '😕', positive: false },
  { type: 'family_disliked', label: "Family didn't like it", emoji: '👎', positive: false },
];

export interface MealFeedbackEntry {
  id: string;
  user_id: string;
  meal_id: string;
  feedback_type: FeedbackType;
  note: string | null;
  created_at: string;
}

export function useMealFeedback() {
  const { session } = useApp();
  const [feedbackByMeal, setFeedbackByMeal] = useState<Record<string, MealFeedbackEntry[]>>({});
  const userId = session?.user?.id;

  const submitFeedback = useCallback(async (
    mealId: string,
    feedbackType: FeedbackType,
    note?: string,
  ) => {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('meal_feedback')
      .insert({
        user_id: userId,
        meal_id: mealId,
        feedback_type: feedbackType,
        note: note || null,
      } as any)
      .select()
      .single();

    if (error) {
      console.error('Failed to submit feedback:', error);
      return null;
    }

    const entry = data as unknown as MealFeedbackEntry;

    // Update local state
    setFeedbackByMeal(prev => ({
      ...prev,
      [mealId]: [...(prev[mealId] || []), entry],
    }));

    // Trigger score recalculation
    await supabase.rpc('recalculate_meal_scores', { p_meal_id: mealId } as any).catch(() => {});

    return entry;
  }, [userId]);

  const fetchFeedback = useCallback(async (mealIds: string[]) => {
    if (!userId || mealIds.length === 0) return;

    const { data } = await supabase
      .from('meal_feedback')
      .select('*')
      .eq('user_id', userId)
      .in('meal_id', mealIds as any);

    const grouped: Record<string, MealFeedbackEntry[]> = {};
    ((data || []) as unknown as MealFeedbackEntry[]).forEach(f => {
      if (!grouped[f.meal_id]) grouped[f.meal_id] = [];
      grouped[f.meal_id].push(f);
    });

    setFeedbackByMeal(prev => ({ ...prev, ...grouped }));
  }, [userId]);

  const getFeedbackForMeal = useCallback((mealId: string): MealFeedbackEntry[] => {
    return feedbackByMeal[mealId] || [];
  }, [feedbackByMeal]);

  const removeFeedback = useCallback(async (feedbackId: string, mealId: string) => {
    await supabase.from('meal_feedback').delete().eq('id', feedbackId);
    setFeedbackByMeal(prev => ({
      ...prev,
      [mealId]: (prev[mealId] || []).filter(f => f.id !== feedbackId),
    }));
    await supabase.rpc('recalculate_meal_scores', { p_meal_id: mealId } as any).catch(() => {});
  }, []);

  return {
    submitFeedback,
    fetchFeedback,
    getFeedbackForMeal,
    removeFeedback,
    feedbackByMeal,
  };
}
