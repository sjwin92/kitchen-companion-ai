import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FoodItem, InventoryLifecycle, UserPreferences } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { canonicalizeDietaryPreferences, dietExcludesFood } from '../../supabase/functions/_shared/dietary-rules';
import { appError } from '@/lib/appError';

interface AppState {
  inventory: FoodItem[];
  preferences: UserPreferences;
  session: Session | null;
  loading: boolean;
  profileError: string | null;
  inventoryError: string | null;
  addItems: (items: FoodItem[]) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  transitionItem: (id: string, state: InventoryLifecycle, reason?: string) => Promise<void>;
  updateItem: (id: string, updates: Partial<FoodItem>) => Promise<void>;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  savePreferences: (prefs: UserPreferences) => Promise<void>;
  completeOnboarding: (prefs?: Partial<UserPreferences>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshInventory: () => Promise<void>;
  retryProfile: () => void;
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

function normalizePreferences(next: UserPreferences): UserPreferences {
  const dietaryPreferences = canonicalizeDietaryPreferences(next.dietaryPreferences);
  return {
    ...next,
    dietaryPreferences,
    dislikedIngredients: next.dislikedIngredients.filter(
      (ingredient) => !dietExcludesFood(ingredient, dietaryPreferences),
    ),
  };
}

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
  const [profileError, setProfileError] = useState<string | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [profileReload, setProfileReload] = useState(0);
  const [inventory, setInventory] = useState<FoodItem[]>([]);
  const [preferences, setPrefs] = useState<UserPreferences>(defaultPreferences);
  const userId = session?.user?.id;

  // Auth listener. Keep the app gated until the signed-in user's profile is loaded.
  useEffect(() => {
    let currentUserId: string | null = null;
    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (nextUserId !== currentUserId) {
        currentUserId = nextUserId;
        setLoading(Boolean(nextSession));
        setProfileError(null);
      }
      setSession(nextSession);
      if (!nextSession) {
        setInventory([]);
        setInventoryError(null);
        setPrefs(defaultPreferences);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      applySession(initialSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load profile when session changes
  useEffect(() => {
    if (!userId) return;
    
    let cancelled = false;
    const loadProfile = async () => {
      setLoading(true);
      setProfileError(null);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setProfileError('We could not load your saved kitchen profile. Your data has not been changed.');
        setLoading(false);
        return;
      }

      let profile = data;
      if (!profile) {
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .upsert({ id: userId }, { onConflict: 'id' })
          .select('*')
          .single();

        if (cancelled) return;
        if (createError) {
          setProfileError('We could not create your kitchen profile. Please retry before continuing.');
          setLoading(false);
          return;
        }
        profile = created;
      }

      if (profile) {
        setPrefs(normalizePreferences({
          householdSize: profile.household_size ?? 2,
          dietaryPreferences: canonicalizeDietaryPreferences(profile.dietary_preferences ?? []),
          cookingTime: profile.cooking_time ?? '30 min',
          maxPrepTime: profile.max_prep_time ?? 60,
          dailyCalorieGoal: profile.daily_calorie_goal ?? 2000,
          dislikedIngredients: profile.disliked_ingredients ?? [],
          onboardingComplete: profile.onboarding_complete ?? false,
          displayName: profile.display_name ?? '',
          preferredCuisines: profile.preferred_cuisines ?? [],
          budgetSensitivity: (profile.budget_sensitivity as UserPreferences['budgetSensitivity']) ?? 'medium',
          cookingConfidence: (profile.cooking_confidence as UserPreferences['cookingConfidence']) ?? 'intermediate',
          primaryGoal: (profile.primary_goal as UserPreferences['primaryGoal']) ?? 'reduce-waste',
          planningStyle: (profile.planning_style as UserPreferences['planningStyle']) ?? 'help-choose',
          allergies: profile.allergies ?? [],
          monthlyBudgetGbp: profile.monthly_budget_gbp ?? null,
          lunchboxCount: profile.lunchbox_count ?? 0,
        }));
      }
      setLoading(false);
    };

    void loadProfile();
    return () => { cancelled = true; };
  }, [userId, profileReload]);

  // Load inventory when session changes
  const refreshInventory = useCallback(async () => {
    if (!userId) return;
    setInventoryError(null);
    const { data, error } = await supabase
      .from('food_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      setInventoryError('We could not refresh your inventory. Your saved food has not been changed.');
      throw appError(error, 'We could not refresh your inventory. Please try again.');
    }

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
  }, [userId]);

  useEffect(() => {
    void refreshInventory().catch(() => undefined);
  }, [refreshInventory]);

  const addItems = useCallback(async (items: FoodItem[]) => {
    if (!userId) return;
    const rows = items.map(item => ({
      user_id: userId,
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
    if (error) throw appError(error, 'Your food was not saved. Please try again.');
    await refreshInventory();
  }, [userId, refreshInventory]);

  const removeItem = useCallback(async (id: string) => {
    const { error } = await supabase.rpc('transition_inventory_item' as never, {
      p_item_id: id,
      p_to_state: 'consumed',
      p_quantity_delta: null,
      p_reason: 'Marked as used',
    } as never);
    if (error) throw appError(error, 'We could not mark this item as used. Please try again.');
    setInventory(prev => prev.filter(i => i.id !== id));
  }, []);

  const transitionItem = useCallback(async (id: string, state: InventoryLifecycle, reason?: string) => {
    const { error } = await supabase.rpc('transition_inventory_item' as never, {
      p_item_id: id,
      p_to_state: state,
      p_quantity_delta: null,
      p_reason: reason ?? null,
    } as never);
    if (error) throw appError(error, 'We could not update this item. Please try again.');
    await refreshInventory();
  }, [refreshInventory]);

  const updateItem = useCallback(async (id: string, updates: Partial<FoodItem>) => {
    const dbUpdates: { name?: string; quantity?: string; location?: string; days_until_expiry?: number; expiry_date?: string; status?: string } = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.daysUntilExpiry !== undefined) dbUpdates.days_until_expiry = updates.daysUntilExpiry;
    if (updates.expiryDate !== undefined) dbUpdates.expiry_date = updates.expiryDate;
    if (updates.status !== undefined) dbUpdates.status = updates.status;

    const { data, error } = await supabase.from('food_items').update(dbUpdates).eq('id', id).select('id').maybeSingle();
    if (error) throw appError(error, 'Your changes were not saved. Please try again.');
    if (!data) throw appError(null, 'This item could not be found. Refresh your inventory and try again.', { code: 'NOT_FOUND', retryable: false });
    setInventory(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  }, []);

  const persistPreferences = useCallback(async (next: UserPreferences) => {
    if (!session?.user) return;
    const normalized = normalizePreferences(next);
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      household_size: normalized.householdSize,
      dietary_preferences: normalized.dietaryPreferences,
      cooking_time: normalized.cookingTime,
      max_prep_time: normalized.maxPrepTime,
      daily_calorie_goal: normalized.dailyCalorieGoal,
      disliked_ingredients: normalized.dislikedIngredients,
      onboarding_complete: normalized.onboardingComplete,
      display_name: normalized.displayName,
      preferred_cuisines: normalized.preferredCuisines,
      budget_sensitivity: normalized.budgetSensitivity,
      cooking_confidence: normalized.cookingConfidence,
      primary_goal: normalized.primaryGoal,
      planning_style: normalized.planningStyle,
      allergies: normalized.allergies,
      monthly_budget_gbp: normalized.monthlyBudgetGbp,
      lunchbox_count: normalized.lunchboxCount,
    }, { onConflict: 'id' });
    if (error) throw error;
  }, [session?.user]);

  const savePreferences = useCallback(async (next: UserPreferences) => {
    const normalized = normalizePreferences(next);
    await persistPreferences(normalized);
    setPrefs(normalized);
  }, [persistPreferences]);

  const setPreferences = useCallback((prefs: Partial<UserPreferences>) => {
    const next = normalizePreferences({ ...preferences, ...prefs });
    setPrefs(next);
    void persistPreferences(next).catch(() => {
      setProfileError('Your latest preference change was not saved. Please retry from Settings.');
    });
  }, [persistPreferences, preferences]);

  const completeOnboarding = useCallback(async (updates: Partial<UserPreferences> = {}) => {
    const next = normalizePreferences({ ...preferences, ...updates, onboardingComplete: true });
    await persistPreferences(next);
    setPrefs(next);
  }, [preferences, persistPreferences]);

  const retryProfile = useCallback(() => setProfileReload(current => current + 1), []);

  const signOut = useCallback(async () => {
    const userId = session?.user.id;
    if (userId) localStorage.removeItem(`mealplan-draft:${userId}`);
    await supabase.auth.signOut();
  }, [session?.user.id]);

  return (
    <AppContext.Provider value={{ inventory, preferences, session, loading, profileError, inventoryError, addItems, removeItem, transitionItem, updateItem, setPreferences, savePreferences, completeOnboarding, signOut, refreshInventory, retryProfile }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
