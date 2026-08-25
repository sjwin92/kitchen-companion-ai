import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FoodItem, InventoryLifecycle, UserPreferences } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

interface AppState {
  inventory: FoodItem[];
  preferences: UserPreferences;
  session: Session | null;
  loading: boolean;
  addItems: (items: FoodItem[]) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  transitionItem: (id: string, state: InventoryLifecycle, reason?: string) => Promise<void>;
  updateItem: (id: string, updates: Partial<FoodItem>) => Promise<void>;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  savePreferences: (prefs: UserPreferences) => Promise<void>;
  completeOnboarding: (prefs?: Partial<UserPreferences>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshInventory: () => Promise<void>;
}

const defaultPreferences: UserPreferences = {
  householdSize: 2,
  dietaryPreferences: [],
  cookingTime: '30 min',
  maxPrepTime: 60,
  dailyCalorieGoal: 2000,
  dislikedIngredients: [],
  onboardingComplete: false,
  displayName: '',
  preferredCuisines: [],
  budgetSensitivity: 'medium',
  cookingConfidence: 'intermediate',
  primaryGoal: 'reduce-waste',
  planningStyle: 'help-choose',
  allergies: [],
  monthlyBudgetGbp: null,
  lunchboxCount: 0,
};

const AppContext = createContext<AppState | null>(null);

export function deriveFreshness(expiryDate?: string): FoodItem['status'] {
  if (!expiryDate) return 'unknown';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${expiryDate}T00:00:00`);
  const days = Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days === 0) return 'use-today';
  if (days <= 3) return 'use-soon';
  return 'okay';
}

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
          maxPrepTime: (data as any).max_prep_time ?? 60,
          dailyCalorieGoal: data.daily_calorie_goal ?? 2000,
          dislikedIngredients: data.disliked_ingredients ?? [],
          onboardingComplete: data.onboarding_complete ?? false,
          displayName: data.display_name ?? '',
          preferredCuisines: (data as any).preferred_cuisines ?? [],
          budgetSensitivity: (data as any).budget_sensitivity ?? 'medium',
          cookingConfidence: (data as any).cooking_confidence ?? 'intermediate',
          primaryGoal: (data as any).primary_goal ?? 'reduce-waste',
          planningStyle: (data as any).planning_style ?? 'help-choose',
          allergies: (data as any).allergies ?? [],
          monthlyBudgetGbp: (data as any).monthly_budget_gbp ?? null,
          lunchboxCount: (data as any).lunchbox_count ?? 0,
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
      setInventory(data
        .filter(item => !('lifecycle_state' in item) || ['available', 'reserved'].includes(String((item as Record<string, unknown>).lifecycle_state)))
        .map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        location: item.location as FoodItem['location'],
        dateAdded: item.date_added,
        daysUntilExpiry: item.days_until_expiry,
        expiryDate: (item as any).expiry_date || undefined,
        status: deriveFreshness((item as Record<string, unknown>).expiry_date as string | undefined),
        quantityValue: (item as Record<string, unknown>).quantity_value as number | undefined,
        unit: (item as Record<string, unknown>).unit as string | undefined,
        lifecycleState: ((item as Record<string, unknown>).lifecycle_state as InventoryLifecycle | undefined) ?? 'available',
        provenance: (item as Record<string, unknown>).provenance as FoodItem['provenance'],
        confidence: (item as Record<string, unknown>).confidence as number | undefined,
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
      expiry_date: item.expiryDate || null,
      status: item.status,
      quantity_value: item.quantityValue ?? null,
      unit: item.unit ?? null,
      lifecycle_state: item.lifecycleState ?? 'available',
      provenance: item.provenance ?? 'user',
      confidence: item.confidence ?? null,
    }));

    const { error } = await supabase.from('food_items').insert(rows);
    if (!error) refreshInventory();
  }, [session?.user?.id, refreshInventory]);

  const removeItem = useCallback(async (id: string) => {
    const { error } = await supabase.rpc('transition_inventory_item' as never, {
      p_item_id: id,
      p_to_state: 'consumed',
      p_quantity_delta: null,
      p_reason: 'Marked as used',
    } as never);
    if (!error) setInventory(prev => prev.filter(i => i.id !== id));
  }, []);

  const transitionItem = useCallback(async (id: string, state: InventoryLifecycle, reason?: string) => {
    const { error } = await supabase.rpc('transition_inventory_item' as never, {
      p_item_id: id,
      p_to_state: state,
      p_quantity_delta: null,
      p_reason: reason ?? null,
    } as never);
    if (error) throw error;
    setInventory(prev => ['available', 'reserved'].includes(state) ? prev.map(item => item.id === id ? { ...item, lifecycleState: state } : item) : prev.filter(item => item.id !== id));
  }, []);

  const updateItem = useCallback(async (id: string, updates: Partial<FoodItem>) => {
    const dbUpdates: { name?: string; quantity?: string; location?: string; days_until_expiry?: number; expiry_date?: string; status?: string } = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.daysUntilExpiry !== undefined) dbUpdates.days_until_expiry = updates.daysUntilExpiry;
    if (updates.expiryDate !== undefined) dbUpdates.expiry_date = updates.expiryDate;
    if (updates.status !== undefined) dbUpdates.status = updates.status;

    const { error } = await supabase.from('food_items').update(dbUpdates).eq('id', id);
    if (!error) setInventory(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  }, []);

  const persistPreferences = useCallback(async (next: UserPreferences) => {
    if (!session?.user) return;
    const { error } = await supabase.from('profiles').update({
      household_size: next.householdSize,
      dietary_preferences: next.dietaryPreferences,
      cooking_time: next.cookingTime,
      max_prep_time: next.maxPrepTime,
      daily_calorie_goal: next.dailyCalorieGoal,
      disliked_ingredients: next.dislikedIngredients,
      onboarding_complete: next.onboardingComplete,
      display_name: next.displayName,
      preferred_cuisines: next.preferredCuisines,
      budget_sensitivity: next.budgetSensitivity,
      cooking_confidence: next.cookingConfidence,
      primary_goal: next.primaryGoal,
      planning_style: next.planningStyle,
      allergies: next.allergies,
      monthly_budget_gbp: next.monthlyBudgetGbp,
      lunchbox_count: next.lunchboxCount,
    } as never).eq('id', session.user.id);
    if (error) throw error;
  }, [session?.user]);

  const savePreferences = useCallback(async (next: UserPreferences) => {
    await persistPreferences(next);
    setPrefs(next);
  }, [persistPreferences]);

  const setPreferences = useCallback((prefs: Partial<UserPreferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...prefs };
      void persistPreferences(next);
      return next;
    });
  }, [persistPreferences]);

  const completeOnboarding = useCallback(async (updates: Partial<UserPreferences> = {}) => {
    const next = { ...preferences, ...updates, onboardingComplete: true };
    const { error } = await supabase.rpc('complete_onboarding' as never, { p_preferences: next } as never);
    if (error) throw error;
    setPrefs(next);
  }, [preferences]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AppContext.Provider value={{ inventory, preferences, session, loading, addItems, removeItem, transitionItem, updateItem, setPreferences, savePreferences, completeOnboarding, signOut, refreshInventory }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
