import React, { createContext, useContext, useState, useCallback } from 'react';
import { FoodItem, UserPreferences } from '@/types';
import { MOCK_FOOD_ITEMS } from '@/data/mockData';

interface AppState {
  inventory: FoodItem[];
  preferences: UserPreferences;
  addItems: (items: FoodItem[]) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<FoodItem>) => void;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  completeOnboarding: () => void;
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
  const [inventory, setInventory] = useState<FoodItem[]>(MOCK_FOOD_ITEMS);
  const [preferences, setPrefs] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem('cookbuddy-prefs');
    return saved ? JSON.parse(saved) : defaultPreferences;
  });

  const addItems = useCallback((items: FoodItem[]) => {
    setInventory(prev => [...prev, ...items]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setInventory(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<FoodItem>) => {
    setInventory(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  }, []);

  const setPreferences = useCallback((prefs: Partial<UserPreferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...prefs };
      localStorage.setItem('cookbuddy-prefs', JSON.stringify(next));
      return next;
    });
  }, []);

  const completeOnboarding = useCallback(() => {
    setPreferences({ onboardingComplete: true });
  }, [setPreferences]);

  return (
    <AppContext.Provider value={{ inventory, preferences, addItems, removeItem, updateItem, setPreferences, completeOnboarding }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
