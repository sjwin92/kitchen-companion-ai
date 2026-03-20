import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FoodItem, UserPreferences } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

interface AppState {
  inventory: FoodItem[];
  preferences: UserPreferences;
  session: Session | null;
  loading: boolean;
  addItems: (items: FoodItem[]) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<FoodItem>) => void;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  completeOnboarding: () => void;
  signOut: () => Promise<void>;
  refreshInventory: () => Promise<void>;
}

const defaultPreferences: UserPreferences = {
  householdSize: 2,
  dietaryPreferences: [],
  cookingTime: '30 min',
  dislikedIngredients: [],
  onboardingComplete: false,
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<FoodItem[]>([]);
  const [preferences, setPrefs] = useState<UserPreferences>(defaultPreferences);

  // Auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setInventory([]);
        setPrefs(defaultPreferences);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load profile when session changes
  useEffect(() => {
    if (!session?.user) return;
    
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setPrefs({
          householdSize: data.household_size ?? 2,
          dietaryPreferences: data.dietary_preferences ?? [],
          cookingTime: data.cooking_time ?? '30 min',
          dislikedIngredients: data.disliked_ingredients ?? [],
          onboardingComplete: data.onboarding_complete ?? false,
        });
      }
    };

    loadProfile();
  }, [session?.user?.id]);

  // Load inventory when session changes
  const refreshInventory = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('food_items')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setInventory(data.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        location: item.location as FoodItem['location'],
        dateAdded: item.date_added,
        daysUntilExpiry: item.days_until_expiry,
        status: item.status as FoodItem['status'],
      })));
    }
  }, [session?.user?.id]);

  useEffect(() => {
    refreshInventory();
  }, [refreshInventory]);

  const addItems = useCallback(async (items: FoodItem[]) => {
    if (!session?.user) return;
    const rows = items.map(item => ({
      user_id: session.user.id,
      name: item.name,
      quantity: item.quantity,
      location: item.location,
      date_added: item.dateAdded,
      days_until_expiry: item.daysUntilExpiry,
      status: item.status,
    }));

    const { error } = await supabase.from('food_items').insert(rows);
    if (!error) refreshInventory();
  }, [session?.user?.id, refreshInventory]);

  const removeItem = useCallback(async (id: string) => {
    const { error } = await supabase.from('food_items').delete().eq('id', id);
    if (!error) setInventory(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateItem = useCallback(async (id: string, updates: Partial<FoodItem>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.daysUntilExpiry !== undefined) dbUpdates.days_until_expiry = updates.daysUntilExpiry;
    if (updates.status !== undefined) dbUpdates.status = updates.status;

    const { error } = await supabase.from('food_items').update(dbUpdates).eq('id', id);
    if (!error) setInventory(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  }, []);

  const setPreferences = useCallback(async (prefs: Partial<UserPreferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...prefs };

      if (session?.user) {
        supabase.from('profiles').update({
          household_size: next.householdSize,
          dietary_preferences: next.dietaryPreferences,
          cooking_time: next.cookingTime,
          disliked_ingredients: next.dislikedIngredients,
          onboarding_complete: next.onboardingComplete,
        }).eq('id', session.user.id).then();
      }

      return next;
    });
  }, [session?.user?.id]);

  const completeOnboarding = useCallback(() => {
    setPreferences({ onboardingComplete: true });
  }, [setPreferences]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AppContext.Provider value={{ inventory, preferences, session, loading, addItems, removeItem, updateItem, setPreferences, completeOnboarding, signOut, refreshInventory }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
