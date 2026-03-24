import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import type { MealSlot } from './useMealPlans';

export interface SlotSettings {
  id?: string;
  slot: MealSlot;
  target_prep_time: string;
  complexity: string;
  servings: number;
  quick_bias: boolean;
  family_friendly_bias: boolean;
  pantry_first_bias: boolean;
  budget_friendly_bias: boolean;
  cuisine_preference: string | null;
}

const DEFAULT_SETTINGS: Omit<SlotSettings, 'slot'> = {
  target_prep_time: '30 min',
  complexity: 'medium',
  servings: 2,
  quick_bias: false,
  family_friendly_bias: false,
  pantry_first_bias: false,
  budget_friendly_bias: false,
  cuisine_preference: null,
};

export function useMealSlotSettings() {
  const { session, preferences } = useApp();
  const [settings, setSettings] = useState<SlotSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = session?.user?.id;

  const fetchSettings = useCallback(async () => {
    if (!userId) { setSettings([]); setLoading(false); return; }
    const { data } = await supabase
      .from('meal_slot_settings')
      .select('*')
      .eq('user_id', userId);

    if (data) {
      setSettings(data.map((d: any) => ({
        id: d.id,
        slot: d.slot as MealSlot,
        target_prep_time: d.target_prep_time ?? '30 min',
        complexity: d.complexity ?? 'medium',
        servings: d.servings ?? preferences.householdSize,
        quick_bias: d.quick_bias ?? false,
        family_friendly_bias: d.family_friendly_bias ?? false,
        pantry_first_bias: d.pantry_first_bias ?? false,
        budget_friendly_bias: d.budget_friendly_bias ?? false,
        cuisine_preference: d.cuisine_preference ?? null,
      })));
    }
    setLoading(false);
  }, [userId, preferences.householdSize]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const getSlotSettings = useCallback((slot: MealSlot): SlotSettings => {
    const found = settings.find(s => s.slot === slot);
    if (found) return found;
    return { slot, ...DEFAULT_SETTINGS, servings: preferences.householdSize };
  }, [settings, preferences.householdSize]);

  const updateSlotSettings = useCallback(async (slot: MealSlot, updates: Partial<SlotSettings>) => {
    if (!userId) return;
    const { error } = await supabase
      .from('meal_slot_settings')
      .upsert({
        user_id: userId,
        slot,
        ...updates,
      } as any, { onConflict: 'user_id,slot' });

    if (!error) await fetchSettings();
  }, [userId, fetchSettings]);

  return { settings, loading, getSlotSettings, updateSlotSettings };
}
