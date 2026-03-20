export type StorageLocation = 'fridge' | 'freezer' | 'cupboard';

export type FreshnessStatus = 'use-today' | 'use-soon' | 'okay';

export interface FoodItem {
  id: string;
  name: string;
  quantity: string;
  location: StorageLocation;
  dateAdded: string;
  daysUntilExpiry: number;
  status: FreshnessStatus;
}

export interface MealSuggestion {
  id: string;
  title: string;
  description: string;
  prepTime: string;
  ingredients: string[];
  image?: string;
}

export interface UserPreferences {
  householdSize: number;
  dietaryPreferences: string[];
  cookingTime: string;
  dislikedIngredients: string[];
  onboardingComplete: boolean;
  displayName: string;
}
